# Decisions Log — LetterApp (temporary name)

Last updated: 2026-09-21 · Phase: **1 (foundation + i18n/RTL spike) — in progress**

**Precedence:** if `docs/PLAN.md` and this file disagree, **this file wins**. `PLAN.md` holds the detailed architecture; this file records what was decided and why.

**Status values**
- **Accepted** — decided by the project owner.
- **Default** — my recommendation; owner has not objected. Can be changed any time.
- **Needs confirmation** — my interpretation of an ambiguous or under-specified decision; do not build on it until confirmed.
- **Open** — not decided yet, with the milestone when it must be.

---

## A. Platform & architecture

### DEC-001 — Temporary app name `LetterApp` · Accepted
- `LetterApp` is a **development-only name**, not the public brand.
- Name, slug, URL scheme, Android package ID and deep-link domain come from **one file** (`mobile/brand.config.ts`) plus build variants (`dev` / `preview` / `production`). No component or string may hard-code the name; user-visible text uses the i18n key `app.name` (so Arabic may use a different localized name).
- **Naming freeze** is a hard gate before Phase 10 (release): final name, production package ID, domain, then regenerate Google Sign-In / push credentials. The production Android package ID is **permanent after the first Play upload**. Play rejects `com.example.*`.
- Never publish anything under a temporary identifier.
- **Development Android package ID: `com.letterapp.dev`** (set 2026-09-18, resolves OPEN-3). **Development-only.** The production package ID is decided at the naming freeze. Any additional variant IDs (e.g. a `preview` build) are derived from `brand.config.ts` and are likewise non-production.

### DEC-002 — React Native + Expo + TypeScript · Accepted
- Owner has React Native experience; **Flutter is out**.
- Expo Router, TanStack Query, Zustand, react-hook-form + zod, expo-sqlite (offline drafts), expo-secure-store, i18next.
- **Development builds (EAS)** from Phase 1; Expo Go is not sufficient for Android push and native Google Sign-In.
- iOS later via EAS cloud builds (no Mac required for builds).

### DEC-003 — Supabase as backend · Accepted
- Auth, Postgres + Row Level Security, Edge Functions, `pg_cron`, Realtime, Storage.
- Schema, RLS, RPCs and cron jobs live only in `supabase/migrations/` (source of truth, versioned in git).
- Storage is provisioned in the architecture but **no buckets are created in the MVP** (see DEC-011).

### DEC-004 — Push notifications via Expo Push Service · Default
- Not explicitly answered by owner. Same code path for Android now and iOS later; FCM credentials are uploaded to EAS.
- Payload never contains letter text (only a localized generic line + `letter_id`).
- Revisit if we want to remove the Expo relay (would mean direct FCM/APNs from an Edge Function).

### DEC-005 — Server-side scheduled delivery · Default
- `pg_cron` every minute → `deliver_due_letters()` → `notification_outbox` → Edge Function → push.
- "Send now" is `scheduled_at = now()` (one code path). Accuracy target ≈ 1 minute. Timestamps stored in UTC.
- Permissions are **re-checked at delivery time**; failures become `undeliverable` (neutral message to sender, no notification, recipient never sees it).

---

## B. Privacy, discovery and permissions

### DEC-006 — Receiving setting (per-user) · Accepted
- Each user has `receive_mode`:
  - **`everyone`** — anyone who can find the user may send a letter without a prior invite.
  - **`invite_only`** — only **accepted pen-pal connections** may send letters.
- **Default for new accounts: `invite_only`.** Changeable at any time in Settings → Privacy.
- **Blocking and reporting work regardless of this setting**, always.
- Switching the mode never deletes existing connections or already-delivered letters. Scheduled letters are re-checked at delivery (DEC-005).
- "Can find the user" = discoverable by username/email per their settings, or holds their invite link. Discoverability only controls **search**; the send permission itself is enforced server-side by `can_send(sender, recipient, parent_letter)`.

### DEC-007 — Pen-pal connections: request + accept/decline flow in the MVP · Accepted (2026-09-18)
Final behavior, as confirmed by the owner:

1. **`receive_mode = everyone`:** another user can send them a letter **without** an accepted connection.
2. **`receive_mode = invite_only`:** the sender **must** have an **accepted pen-pal connection** with the recipient before sending.
3. A connection is established in exactly one of two ways:
   1. **Connection request** sent from the recipient's search result or profile, which the recipient **accepts** (or declines); or
   2. **Invite link / code / QR** shared by the existing user — redeeming it creates the connection **already accepted**.
4. A **pending** request **cannot** send letters. Only `accepted` connections grant sending rights.
5. **Either connected user can remove** the connection at any time.
6. **Blocking removes** the connection and any pending requests between the two users.
7. A recipient can **always reply** to a letter they received, unless either user has blocked the other.

Implementation notes (design details built on the rules above):
- Connections are **mutual**: once accepted, both users can write to each other regardless of either one's `receive_mode`. Removing the connection ends that; letters already delivered stay.
- A request carries **no free text** (just the requester's `@username` and display name), to limit abuse.
- Connection requests are offered in the UI for `invite_only` users; `everyone` users show "Write letter" directly (see DEC-008).
- New MVP surface: `connections` table (replaces the earlier `allowed_senders`), a connection-requests screen (incoming/outgoing, accept/decline/cancel), and "remove connection" in the profile view.
- All connection changes go through RPCs; clients never write `connections` directly.

**Provisional numbers (NOT final product decisions — revisit and finalize in Phase 2/5, tracked as OPEN-5):**
- 30-day cooldown before a declined requester may re-request the same person
- Max 20 outstanding pending requests per user
- Daily request rate limit (value to be proposed in Phase 5)

`can_send(sender A, recipient B, parent)`, evaluated at send **and** at delivery (DEC-005):
1. Either user has blocked the other → **no**
2. A = B → yes
3. Letter is a **reply** to a delivered letter that A received from B → yes
4. B.receive_mode = `everyone` → yes
5. B.receive_mode = `invite_only` → yes only if an **accepted** connection A↔B exists (pending/declined/none → no)
6. Otherwise → no

### DEC-008 — Username search is the primary discovery method · Accepted
- `search_users(q)`: prefix match, **≥ 3 characters**, max 20 results, rate-limited (numbers provisional, OPEN-5), only users with `discoverable_by_username = true` (default **true**), excludes self and users who have blocked the caller.
- Result rows expose only `id, username, display_name, avatar_key, receive_mode` and the caller's connection state (`none | pending_out | pending_in | connected`).
- UI copy for invite-only users: "Send a connection request" (not "Write letter").

### DEC-009 — Email search · Accepted
- Included in MVP. **Opt-in, OFF by default** (`discoverable_by_email = false`); asked once during onboarding and changeable in Settings → Privacy.
- **Exact match only** (case-insensitive, normalized), **verified emails only**.
- **Uniform response:** "no account", "account exists but email search is off" and "email search disabled" return the *same empty result*. Nothing about the account's existence is revealed.
- The email address is **never returned** to any client and never logged. Rate-limited (default 10 lookups/hour/user). Implemented as a `SECURITY DEFINER` RPC; the app never reads `auth.users`.
- A user found by email follows the same rules as any other (DEC-006/007).

### DEC-010 — Usernames and display names · Accepted (rule details are my design; finalize in Phase 2)
**Usernames**
- Characters: `a–z`, `0–9`, `_` only. Length **3–20**. Stored lowercase; uniqueness is **case-insensitive**.
- Must **start with a letter**; no trailing `_`; no consecutive `__`.
- **Anti-look-alike:** every username has a canonical **skeleton** (lowercase, remove `_`, map `0→o`, `1→l`, `i→l`, `5→s`, `rn→m`, `vv→w`). A **unique index on the skeleton** blocks `paypa1` vs `paypal`, `rnia` vs `mia`, `a_b` vs `ab`. **Mapping finalized 2026-09-21 (Phase 2 step 1):** apply, in this order, (1) drop `_`, (2) `rn` to `m`, (3) `vv` to `w`, (4) `0` to `o`, `1` to `l`, `i` to `l`, `5` to `s`; each step is one left-to-right, non-overlapping pass (this is exactly what Postgres `replace()` does), so the SQL skeleton function must reproduce it step for step. `mobile/src/domain/username.ts` is the reference and `mobile/__tests__/username.test.ts` holds the vectors to reuse in pgTAP. The reserved list lives in `username.ts` (brand words come from `brand.config.ts`); the database keeps its own copy, so change both together. Collisions show the same generic "not available".
- **Reserved list** (checked on the skeleton too): `admin, administrator, support, help, staff, moderator, official, system, security, root, null, undefined, api, www` + brand words (`letterapp`, and the final brand once chosen).
- **Changes:** at most once per 30 days; the old username stays **reserved for its previous owner for 90 days** (prevents someone grabbing a name people already trust).
- Availability checks are rate-limited.
- Usernames are always displayed as `@username`, rendered **left-to-right even in RTL UI** (directional isolate).

**Display names**
- Any Unicode letters incl. Arabic, 1–50 characters. NFC-normalized, trimmed, whitespace collapsed.
- **Stripped/rejected:** control characters, zero-width characters and **bidi override/embedding characters** (U+200B–U+200F, U+202A–U+202E, U+2066–U+2069, U+FEFF); must contain at least one letter or digit; no `@` and no URLs; reserved words as above.
- **`@username` is always shown next to a display name** in search results, connection requests, and letter headers, so a copied display name cannot impersonate someone.
- Report reasons include **"impersonation"**. (Verified badges are out of scope.)

### DEC-011 — Avatars: preset icons only in MVP · Accepted
- `profiles.avatar_key` references a fixed catalog `shared/avatar-catalog.json` (~24 icons). Validated on client and in the database.
- **No image upload, no Storage bucket, no image moderation in MVP.**
- Extensibility (built now, costs nothing): the UI uses one `<Avatar source={…}>` component with a discriminated union `{ type: 'preset', key } | { type: 'image', path }`; the `image` variant is unimplemented. Later version adds a nullable `avatar_path` column, a **private** Storage bucket with signed URLs, size/type limits, image moderation and report flow, and a "remove avatar" action.

### DEC-012 — Invite links and deep links · Accepted
- Development scheme: **`letterapp://invite/<code>`**, handled by route `mobile/app/invite/[code].tsx`. The scheme is read from `brand.config.ts`.
- Invite codes: random, 10-char base32, revocable (regenerate = revoke old), redemption rate-limited, identical generic error for unknown/expired/revoked.
- The app also offers **copy code**, **QR code**, and **manual code entry**, because custom-scheme links are often not tappable in messaging apps.
- **No production web domain is chosen.** No HTTPS App Links, landing page or `assetlinks.json` until the **naming freeze**. Note: the domain is compiled into the Android manifest, so the final one must be decided before the first production build.
- Known limits of the dev scheme (acceptable for development, **not for production**): other apps can register the same scheme on Android; no support for people without the app installed; no deferred deep links.

### DEC-013 — Blocking & reporting · Accepted
- Available on every letter, profile, search result and connection request, independent of `receive_mode` and connection state.
- Blocking is mutual in effect: neither side can send to or find the other; deletes any connection/pending request; scheduled letters between them become `undeliverable`.
- The blocked person is never told. Reports go to a `reports` table reviewed via the Supabase dashboard in MVP.

---

## C. Languages & localization

### DEC-014 — Arabic + English from day one · Accepted
- Full **RTL/LTR** support, localization, and **runtime language switching without separate builds** (System / English / العربية). A direction change (en↔ar) needs a **confirmed app reload**; same-direction changes do not.
- **Modern Standard Arabic** for initial UI copy. Avoid gendered second-person phrasing where possible.
- **Western digits (0–9)** in both languages. **Gregorian calendar** in both languages.
  - Implementation rule: always format with explicit Unicode extensions, e.g. `ar-u-ca-gregory-nu-latn` and `en-u-ca-gregory-nu-latn`, never bare `ar` / `ar-SA` (some engines default those to Arabic-Indic digits or the Hijri calendar). **To verify on-device in the Phase 1 spike.**
- **Owner reviews and approves all final Arabic UI copy before release.** Arabic strings written by Claude are **provisional** and tracked in `docs/ARABIC_REVIEW.md` (created in Phase 1) with a status per key (`draft` → `approved`). **Release gate: no `draft` strings in `ar.json`.**
- Letters have their own direction (`body_dir`, detected from the first strong character and stored), independent of the viewer's UI language.
- Design fonts declare supported scripts; Arabic letters only offer / fall back to Arabic-capable fonts.
- Push notifications are localized server-side from `profiles.locale`; API errors are codes, not text.

---

## D. Other defaults (from the plan; change any time)

| ID | Decision | Status |
|---|---|---|
| DEC-020 | Letters are immutable after delivery; scheduled letters can be edited/unscheduled until delivery | Default |
| DEC-021 | Letter to yourself is allowed | Default |
| DEC-022 | Single recipient per letter in MVP (schema can extend later) | Default |
| DEC-023 | "Delete for me" only (no delete-for-both) | Default |
| DEC-024 | No anonymous letters | Default |
| DEC-025 | Read receipts on by default (per-user toggle) | Default |
| DEC-026 | Plain text + design in MVP (no rich text / images / attachments) | Default |
| DEC-027 | Not end-to-end encrypted in MVP; privacy policy says so plainly | Default |
| DEC-028 | Minimum Android: API 26 (Android 8.0) | Default |
| DEC-029 | Minimum user age 13+ (legal review before release) | Default |
| DEC-030 | Sending to people without an account is out of MVP | Default |
| DEC-031 | Email + password (verified) and Google Sign-In; Apple Sign-In with iOS | Default |
| DEC-032 | Crash reporting: Sentry; analytics: opt-in only | Default |
| DEC-033 | Monetization out of scope for MVP | Default |
| DEC-035 | **Expo SDK 57 (2026-09-19, owner-confirmed):** `expo@~57.0.24`, React Native 0.86.3, React 19.2.3, TypeScript ~6.0.3, Node 22 LTS. SDK 58 is preview-only and is not used. Notes: `react-dom` is pinned to 19.2.3 because `expo-router` → `vaul` → Radix has a non-optional `react-dom` peer (unpinned, npm picks 19.3.0 and fails ERESOLVE); TS 6 needs an explicit `types` list; RNTL 14 uses `test-renderer` and an async `render`; `app.config.ts` must import `./brand.config.ts` with the extension; ESLint is pinned to **9.x** (`eslint-plugin-import`/`-react` in `eslint-config-expo` 57 do not yet accept ESLint 10; npm marks 9.39 "no longer supported" — revisit when the plugins allow 10) | Accepted |
| DEC-036 | **UI language preference (2026-09-19):** System / English / العربية, default System (device language if `ar`/`en`, else `en`). Stored locally in `expo-sqlite/kv-store` (synchronous read, so the first render already has the right language and direction); the server copy `profiles.locale` is added in Phase 2. Direction is applied with `I18nManager.allowRTL/forceRTL` and takes effect after a confirmed reload (`reloadApp()`); a persisted guard prevents a reload loop. `expo-localization` plugin sets `supportsRTL` and `supportedLocales: ['en','ar']` (`forcesRTL` deliberately unset). i18next 26 + react-i18next 17 with typed keys from `en.json` | Accepted |
| DEC-037 | **Hermes lacks `Intl.PluralRules` → polyfill (2026-09-20, owner-approved):** `@formatjs/intl-pluralrules` is loaded first in `src/core/i18n/polyfills.ts` (imported at the top of `src/core/i18n/index.ts`), with `ar` and `en` locale data only; it installs itself only when the engine lacks the API. Verified in Jest (native API removed: English and Arabic categories match Node's native results and i18next resolves all six Arabic plural keys) and on the device (Hermes, Android 35: `PluralRules` went from missing to present; `ar` 0:zero 1:one 2:two 3:few 11:many 100:other; `en` 1:one, all other counts `other`). Adds 4 small JS-only packages (`@formatjs/intl-pluralrules`, `bigdecimal`, `fast-memoize`, `intl-localematcher`), no native rebuild. The other missing `Intl` APIs are **not** polyfilled: add one only when a feature needs it | Accepted |
| DEC-034 | **Branching model (2026-09-19, owner):** `main` = stable/release · `dev` = integration/development · `feature/*` = feature branches created from `dev` and merged back into `dev` · `dev` merges into `main` only for stable releases. Repo has `.gitattributes` (`* text=auto eol=lf`) and `core.longpaths=true` (repo-local) | Accepted |

---

## E. Open items

| # | Item | Needed by |
|---|---|---|
| OPEN-2 | Final app name, production package ID, URL scheme, web domain | Naming freeze (before Phase 10) |
| OPEN-4 | **Phase 1 spike — closed except the items below (2026-09-20/21, Android 35 emulator, dev build, Hermes, RN 0.86.3); findings below.** The temporary `/spike` route was deleted on 2026-09-21 (it survives in git history: commits `e0e4d7e`, `5f4c5f2`, `d013a7c`). **Not tested:** interactive `TextInput` behaviour (typing, caret placement, keyboard switching, selection) — no result was reported, so treat it as unverified; only static rendering was checked. Carry it into the Phase 3 composer work and test it there on a real keyboard. Also still to do: check on a physical phone before Phase 7. Native date/time picker: **no picker package is added until the scheduling UI needs one (owner, 2026-09-20)**; what could be observed without one is recorded below | Phase 3 (composer), Phase 7 (device) |

**Spike findings (OPEN-4).** Observed on the emulator by screenshot; device-specific facts should be re-checked on a phone.
- **Direction switch works.** Choosing English while in Arabic (or the reverse) changes text immediately, shows the localized "Restart required" prompt, and `DevSettings.reload()` comes back in the new direction (verified ar/RTL → en/LTR; tab order, header and alignment all flip). Dev builds only until OPEN-8 is resolved.
- **Explicit Intl tags are required (confirms DEC-014).** `en-u-ca-gregory-nu-latn` and `ar-u-ca-gregory-nu-latn` give the Gregorian calendar and Western digits (`الأحد، 20 سبتمبر 2026 في 3:30 م`, `1,234,567.89`). Bare `ar` and `ar-SA` resolve to `numbering=arab` (`٢٠٢٦`, `١٬٢٣٤٬٥٦٧٫٨٩`); the calendar was Gregorian even for `ar-SA` here.
- **Hermes `Intl` is partial.** Native: `DateTimeFormat`, `NumberFormat`, `Collator`, `getCanonicalLocales`. Missing: `PluralRules` (now polyfilled, DEC-037), `RelativeTimeFormat`, `ListFormat`, `Segmenter`, `Locale`, `DisplayNames`. So there is no `Intl`-based "in 3 days" or list formatting; write our own code or add a polyfill when a feature needs it. (Hermes reports every function as native code, so the (since deleted) spike screen could not label a polyfill; the before/after `NO` → `yes` is the evidence.)
- **`@username` needs isolation in RTL text.** In an Arabic sentence the plain string renders `sara_92@`; wrapping it in U+2066…U+2069 renders `@sara_92`. Confirms the CLAUDE.md rule: always isolate usernames (and, by the same reasoning, invite codes and URLs) inside translated or user text.
- **Alignment differs by component.** `Text` follows the *UI* direction (an English line in the Arabic UI is right-aligned); `TextInput` follows the *content* (English text left-aligned, Arabic right-aligned) with or without `textAlign: 'auto'`. Letter bodies must therefore set alignment/`writingDirection` explicitly from the stored `body_dir`, not rely on defaults.
- **System fonts give no Arabic variety.** `sans-serif`, `sans-serif-medium` and `serif` all show the same Arabic glyphs, weight 600 looks like 400 (only regular and bold exist), and `monospace` falls back with wide word spacing. Distinct Arabic design fonts must be bundled (Phase 4, PLAN §3.4). Digits and Latin do differ by family.
- **Mixed content wraps oddly.** A long `letterapp://invite/CODE` inside Arabic text broke at a `/` and the tail landed on its own line: another reason to isolate and to render codes/URLs in their own element.
- **Tooling (Windows, 7 GB RAM).** A local `x86_64` debug build takes ~1.5 h cold (mostly downloading Gradle 9.3.1), then is cached. The emulator (~1.8 GB) and Gradle cannot run together: build first, `./gradlew --stop`, then boot. Metro's first bundle takes ~3.5 min cold. Running `expo start` with `CI=1` turns file watching off: new routes and edits are **not** served until Metro is restarted (restart it, then relaunch the app, after every edit). Killing the `npx` task does not stop Metro; find the `node` process listening on 8081.
- **Emulator bundle download (fix).** Launches often showed a black screen with `ProtocolException: Expected leading [0-9a-fA-F] character but was 0xd` in logcat. Metro's response was valid (`curl` with the app's URL returned 5 well-formed chunks), and the app was fetching over `10.0.2.2` (QEMU's NAT): 4 of 4 launches failed there. Setting React Native's `debug_http_host` preference to `localhost:8081` for the dev app (file `shared_prefs/com.letterapp.dev_preferences.xml`, written with `run-as com.letterapp.dev`) plus `adb reverse tcp:8081 tcp:8081` routed the download through the adb tunnel: 6 of 6 launches succeeded in 13–16 s. This is emulator-local state, not in the repo; it lasts until the app's data is cleared or the app is uninstalled. (Git Bash: set `MSYS_NO_PATHCONV=1` and pass the remote command to `adb shell` as one quoted string.)
- **Date/time picker (owner decision 2026-09-20: no picker package until the scheduling UI needs one).** React Native core has no date/time picker and none is installed, so no picker could be rendered; this is **not** a pass/fail result for any picker. Observed instead: (1) the native locale is separate from the in-app language. With the app in Arabic the device locale stayed `en-US`; with the app in English and Android's per-app locale set to `ar` (`adb shell cmd locale set-app-locales com.letterapp.dev --locales ar`, reset afterwards), `expo-localization` reported `ar (rtl)`, `Intl` defaulted to `ar` and number separators changed, while `i18n.language` stayed `en` and the layout stayed LTR. (2) The `expo-localization` plugin generates `locales_config.xml` (`en`, `ar`), so Android 13+ offers per-app language settings for the app. **Inference, not observed:** native Android pickers take their language from the activity's configuration locale, so they follow the device/per-app locale and not the in-app choice (as PLAN §3.5 expected), and would disagree with the app whenever the two differ. Options for Phase 6: a small custom JS picker (consistent ar/en, Western digits, no native dependency), or a native picker package plus syncing the in-app language to Android's per-app locale. Decide then.
| OPEN-5 | **Provisional numbers to finalize:** connection-request decline cooldown (30 d), max pending requests (20), daily request rate limit (TBD), username-change limit (30 d) and old-name reservation (90 d) | Phase 2 (username) / Phase 5 (requests) |
| OPEN-6 | Privacy policy / ToS authorship and legal review (ar + en) | Before Phase 10 |
| OPEN-7 | Region for the Supabase project (latency + data-residency) | Phase 2 |
| OPEN-8 | **Production reload for direction changes.** PLAN §3.5 says `expo-updates` `reloadAsync()`; it is not installed (native config + EAS runtime-version implications), so `reloadApp()` only works in dev (`DevSettings.reload()`) and **throws in non-dev builds** on purpose. Decide and implement before the first non-debug build (EAS preview/release) | Before the first preview/release build |

---

## F. Change log

| Date | Change |
|---|---|
| 2026-09-18 | Created. Recorded owner decisions 1–6 (temporary name, framework, receive setting = invite-only default, email search opt-in, Latin usernames, preset avatars, `letterapp://` scheme, Arabic/MSA/Western digits/Gregorian). Added DEC-007 (pen-pal connection flow) as *needs confirmation*. |
| 2026-09-18 | **DEC-007 → Accepted.** Request + accept/decline flow is in the MVP alongside invite link/code/QR (auto-accepted). Rules recorded; OPEN-1 removed. Cooldown/limit numbers explicitly provisional (OPEN-5). |
| 2026-09-18 | **OPEN-3 resolved:** development Android package ID = `com.letterapp.dev` (dev-only; production ID decided at naming freeze). |
| 2026-09-19 | Phase 1 started (owner "go"). Added DEC-034 (branching model, `.gitattributes`, `core.longpaths`). |
| 2026-09-19 | Phase 1 step 2: scaffolded `mobile/` on SDK 57 (DEC-035). Routes live in `mobile/app/` (per CLAUDE.md), not the template's `src/app`. Web/demo deps and template Claude/VS Code config removed. `brand.config.ts` + `app.config.ts` with dev/preview variants; production intentionally throws until the naming freeze (OPEN-2). Preview package ID `com.letterapp.preview` and scheme `letterapp-preview` are provisional. |
| 2026-09-19 | Phase 1 step 3: ESLint 9 + `eslint-config-expo`, `npm run lint` = `expo lint -- --max-warnings=0`. Custom rules: no physical left/right styles (`no-restricted-syntax`), no hard-coded UI strings (`eslint-plugin-i18next` in `jsx-only` mode with an allow-list of user-facing props, plus a selector for text keys such as `title`/`tabBarLabel`), `no-explicit-any`, `ban-ts-comment`. Owner confirmed preview identity (`com.letterapp.preview`, `letterapp-preview`) stays. |
| 2026-09-19 | Phase 1 step 4: i18n (en/ar, DEC-036), RTL manager, theme tokens, `DirectionalIcon`, tabs shell (Inbox · Drafts · Sent · Profile) and Language screen; `docs/ARABIC_REVIEW.md` created with every string `draft` (tests keep it in sync with `ar.json`). Added OPEN-8 (production reload). Found: `expo-asset` is required by `@expo/vector-icons` → `expo-font` and was missing from the trimmed template; RNTL 14 `render`/`fireEvent` are async and Expo Router's test store is global (one render scenario per test file). **Not yet verified on a device** — the exit criterion "runs in both languages/directions on a device" is completed in steps 6–7. |
| 2026-09-20 | Phase 1 step 5: GitHub Actions CI (`.github/workflows/ci.yml`) runs typecheck, lint, format check and tests on push to `dev`/`main` and on PRs. Global Gradle config (`D:\APPS\gradle\gradle.properties`, approved by owner): `org.gradle.jvmargs=-Xmx2g`, `kotlin.daemon.jvmargs=-Xmx1g`, daemon idle timeout 10 min; no ABI setting there (ABI is chosen per build: `x86_64` for the emulator). Android build not yet run: only ~800 MB RAM was free, so Gradle and the emulator must run one after the other, not together. |
| 2026-09-20 | Phase 1 steps 6–7 (partly): local `x86_64` debug dev build succeeded and runs on the `Pixel5_API35` emulator in ar/RTL and en/LTR. Added a temporary `__DEV__`-only `/spike` route (`mobile/app/spike.tsx`, `mobile/src/features/spike/`; delete once OPEN-4 is closed). Recorded spike findings under OPEN-4 and added DEC-037/OPEN-9 (`Intl.PluralRules` missing in Hermes: polyfill decision needs owner confirmation). Not done yet: date-picker language test, interactive `TextInput` test, physical device, real commands in `CLAUDE.md`. |
| 2026-09-20 | Phase 1 spike follow-up (owner): added the `Intl.PluralRules` polyfill (DEC-037 → Accepted, OPEN-9 removed) and verified `en`/`ar` plurals in Jest and on the device. Date/time picker: **no picker package added** (deferred to Phase 6); recorded what could be observed without one under OPEN-4 (native locale vs in-app language, per-app locale) and the option list for Phase 6. Recorded the emulator bundle-download fix (`debug_http_host` + `adb reverse`) and Jest now transforms `@formatjs` (`jest.config.js`). |
| 2026-09-21 | Phase 1: deleted the temporary `/spike` route (`mobile/app/spike.tsx`, `mobile/src/features/spike/`, `mobile/__tests__/spike-intl-probe.test.ts`); the explicit-locale `Intl` checks stay covered by `languages.test.ts` and the plural checks by `plural-polyfill.test.ts`. Interactive `TextInput` behaviour remains untested (see OPEN-4). `CLAUDE.md` updated with the verified commands and current status. |
| 2026-09-21 | Phase 2 started (owner "go"). Step 1 done: pure-TS username and display-name rules in `mobile/src/domain/` with tests (skeleton mapping finalized under DEC-010). Found while testing: U+FEFF counts as whitespace in JavaScript, so display names strip `\p{Cf}` (format characters) **before** collapsing whitespace. Confirmed with the project's own `hermesc` that Hermes accepts Unicode property escapes (`\p{L}`, `\p{N}`, `\p{Cf}`, `\p{Cc}`) and rejects invalid ones. The "no URLs" display-name rule is a heuristic (`://`, `www.`, or a dot followed by a common TLD); the database copy must match it. |
