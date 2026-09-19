# Decisions Log — LetterApp (temporary name)

Last updated: 2026-09-18 · Phase: **0 (planning) — no application code exists yet**

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
- **Anti-look-alike:** every username has a canonical **skeleton** (lowercase, remove `_`, map `0→o`, `1→l`, `i→l`, `5→s`, `rn→m`, `vv→w`). A **unique index on the skeleton** blocks `paypa1` vs `paypal`, `rnia` vs `mia`, `a_b` vs `ab`. The exact mapping is finalized and unit-tested in Phase 2. Collisions show the same generic "not available".
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
| DEC-034 | **Branching model (2026-09-19, owner):** `main` = stable/release · `dev` = integration/development · `feature/*` = feature branches created from `dev` and merged back into `dev` · `dev` merges into `main` only for stable releases. Repo has `.gitattributes` (`* text=auto eol=lf`) and `core.longpaths=true` (repo-local) | Accepted |

---

## E. Open items

| # | Item | Needed by |
|---|---|---|
| OPEN-2 | Final app name, production package ID, URL scheme, web domain | Naming freeze (before Phase 10) |
| OPEN-4 | Phase 1 spike results: bidi `TextInput`, Arabic font rendering, Android date picker language, `Intl` Western digits + Gregorian in Hermes | End of Phase 1 |
| OPEN-5 | **Provisional numbers to finalize:** connection-request decline cooldown (30 d), max pending requests (20), daily request rate limit (TBD), username-change limit (30 d) and old-name reservation (90 d) | Phase 2 (username) / Phase 5 (requests) |
| OPEN-6 | Privacy policy / ToS authorship and legal review (ar + en) | Before Phase 10 |
| OPEN-7 | Region for the Supabase project (latency + data-residency) | Phase 2 |

---

## F. Change log

| Date | Change |
|---|---|
| 2026-09-18 | Created. Recorded owner decisions 1–6 (temporary name, framework, receive setting = invite-only default, email search opt-in, Latin usernames, preset avatars, `letterapp://` scheme, Arabic/MSA/Western digits/Gregorian). Added DEC-007 (pen-pal connection flow) as *needs confirmation*. |
| 2026-09-18 | **DEC-007 → Accepted.** Request + accept/decline flow is in the MVP alongside invite link/code/QR (auto-accepted). Rules recorded; OPEN-1 removed. Cooldown/limit numbers explicitly provisional (OPEN-5). |
| 2026-09-18 | **OPEN-3 resolved:** development Android package ID = `com.letterapp.dev` (dev-only; production ID decided at naming freeze). |
| 2026-09-19 | Phase 1 started (owner "go"). Added DEC-034 (branching model, `.gitattributes`, `core.longpaths`). |
