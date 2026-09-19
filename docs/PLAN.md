# LetterApp (temporary name) — Analysis & Implementation Plan — v2

Status: **PLAN ONLY — no code written yet.**
> **v2.1 (2026-09-18):** owner decisions are now recorded in `docs/DECISIONS.md`, which **wins on any conflict**. Changes since v2: receive-mode default is **Invite-only**; "invite-only" means **accepted pen-pal connections** (new `connections` table replaces `allowed_senders`; invite redemption auto-accepts, plus request/accept — DEC-007, **accepted**); username anti-look-alike rules (DEC-010); avatar extensibility (DEC-011).

Revision: v2 — incorporates your decisions (React Native + Expo + TypeScript, Supabase, Arabic + English with full RTL, username/email discovery, invite links, per-user receive setting, temporary app name).

Legend: *(recommended)* = my proposed default; ⚠️ = needs your confirmation.

---

## 0. What changed from v1

| Area | v1 | v2 |
|---|---|---|
| Mobile framework | Flutter | **React Native + Expo (TypeScript)**, Expo Router, development builds via EAS |
| Backend | Supabase + FCM | **Supabase** (Auth, Postgres/RLS, Edge Functions, pg_cron, Realtime, Storage) + **Expo Push Service** for notifications (FCM/APNs handled behind it) |
| Languages | English, i18n "scaffolding" | **Arabic + English from day one**, full RTL/LTR, runtime language switch, localized push notifications |
| Discovery | Exact username only | **Search by username, and by email (privacy-controlled)** + **shareable invite links** |
| Who can send to me | Anyone, block after | **Per-user setting: "Everyone" or "Invite-only" (default Invite-only)** — invite-only = only accepted pen-pal connections (via invite link or accepted request), plus replies |
| App name | Fixed | **Temporary name `LetterApp`**, all naming driven from one config so it can change before publishing |
| DB | 6 tables | + `invites`, `connections`, `username_history`, `api_rate_limits`; profile gets `locale`, `receive_mode`, discoverability flags; letters get `body_dir` and an `undeliverable` status |
| Phases | 10 | 12 — new i18n/RTL spike in Phase 1 and a dedicated Discovery & Invites phase |

---

## 1. Requirements (updated)

### 1.1 Functional

| # | Requirement | Notes |
|---|---|---|
| R1 | Create letters | Composer with subject, body, design, recipient |
| R2 | Save drafts | Autosave; private to author; works offline |
| R3 | Send immediately | Server-validated action; same code path as scheduling |
| R4 | Schedule future delivery | **Server-side** (pg_cron). Phone can be off at delivery time |
| R5 | Receive letters | Inbox, unread state |
| R6 | Reply | Thread model; replying to a delivered letter is always allowed (unless blocked) |
| R7 | Customize design | Paper, font, ink, stamp/sticker, layout; must work for **Arabic and Latin scripts** |
| R8 | Delivery notifications | Push, **localized in the recipient's language**, deep-link to the letter |
| R9 | Android first, iOS later | Expo gives one codebase; iOS is a build/config task later |
| **R10** | **Find users by username and by email** | Username search (prefix, min 3 chars). Email lookup is **exact-match, opt-in, non-enumerable** (see §3.6) |
| **R11** | **Shareable invite links** | Each user has a link/QR; opening it lets the opener send letters to that user even if they are invite-only |
| **R12** | **Receive setting** | Each user chooses **Everyone** or **Invite-only** (default **Invite-only**); see DEC-006/007 |
| **R13** | **Arabic + English, full RTL/LTR** | UI, letter rendering, notifications, dates, plurals, switching without separate builds |
| **R14** | **Temporary naming** | App name/ID/scheme/domain isolated in one config; final brand chosen before first store upload |

### 1.2 Implicit requirements
- Accounts, session persistence, sign-out, **account deletion** (Google Play requirement)
- Abuse controls (block, report, rate limits) — required for user-generated content
- Privacy policy / ToS in both languages, Play Data Safety form
- Reliable scheduled delivery (exactly-once) and correct **time-zone** handling
- Empty / loading / error / offline states in both directions (LTR and RTL)
- **Re-check permissions at delivery time** (recipient may block or switch to invite-only between scheduling and delivery)

---

## 2. Decisions

### 2.1 Your decisions (recorded)

| # | Decision | How I applied it |
|---|---|---|
| 1 | Temporary name `LetterApp` | Single brand config + build variants (§3.7). No hard-coded name anywhere |
| 2 | Username + invite links; search by username **and email** | §3.6, §4 (`profiles`, `invites`, RPCs) |
| 3 | User option: allow anyone, or receive only via invite | `profiles.receive_mode` = `everyone` \| `invite_only` (**default `invite_only`**); `connections` table |
| 4 | Arabic + English, full RTL/LTR, runtime switching | §3.5 |
| 5 | React Native + Expo + TypeScript, Supabase (auth, db, storage, backend) | §3 |

### 2.2 My interpretations — ⚠️ please confirm or correct

| # | Interpretation | Why it matters |
|---|---|---|
| I1 | ~~Default Everyone~~ **Superseded by DEC-006:** default is **Invite-only**; invite-only = accepted pen-pal connections only. Connections are formed by invite link (auto-accepted) or request + accept (**DEC-007, accepted**) | With invite-only as default, search alone would be a dead end, hence the request/accept flow |
| I2 | **Email search** is **exact match only** (user types the full address), works **only if the target enabled "Let people find me by email"** (default **OFF**, asked during onboarding), only matches **verified** emails, is rate-limited, and returns the *same "not found" result* whether the email doesn't exist or isn't discoverable. The email address itself is never returned to any client | An email search that answers "is this email registered?" is a privacy leak and a spam tool. This keeps your feature while limiting harm |
| I3 | **Username search** = prefix/partial match, ≥3 characters, max 20 results, only users with "discoverable by username" ON (default **ON**), rate-limited | Prevents dumping the whole user list |
| I4 | **Usernames are Latin-only**: `a–z`, `0–9`, `_`, 3–20 chars. **Display names can be any Unicode incl. Arabic** | Arabic-script usernames create look-alike (homograph) impersonation and search/normalization problems. Users still see and write Arabic names via the display name |
| I5 | Replying to a letter you received is **always allowed** (unless blocked), even if the original sender is invite-only | Otherwise invite-only would break conversations |
| I6 | Sending to non-users remains **out of MVP**. Invite link for someone without the app opens a landing page → store; after install they tap the link again (no deferred deep link in MVP) | Deferred deep linking adds complexity |
| I7 | Push via **Expo Push Service** (not raw FCM) | Simplest with Expo, same code for iOS later. Trade-off: one extra intermediary that sees the push payload (we send no letter text, §6.5) |
| I8 | Arabic UI copy = **Modern Standard Arabic**, phrasing that avoids gendered second person where possible | Arabic is grammatically gendered; avoiding it saves rework |
| I9 | Digits: **Western (0–9)** in both languages by default; an "Arabic-Indic digits (٠–٩)" toggle can come later | Common convention in Arabic apps; you may prefer otherwise |
| I10 | Calendar: **Gregorian**; Hijri support is a later option | Scheduling logic stays simple |
| I11 | **Profile avatars = preset icons in MVP.** Supabase Storage is provisioned in the architecture but user-uploaded images (avatars, letter attachments) come in v1.1 | User-uploaded images visible to strangers require moderation (NSFW, illegal content). Say so if you want avatar upload in MVP — it adds an image-moderation/reporting requirement |

### 2.3 Still open (non-blocking, defaults applied)

| # | Question | Default |
|---|---|---|
| O1 | Who reviews/finalizes Arabic copy (you, a translator)? | I draft, a native speaker reviews before release |
| O2 | **Domain for invite links** (needed for `https://…/i/<code>` App Links) | Use custom scheme `letterapp://invite/<code>` in development; a temporary free landing-page subdomain for testing; real domain chosen with the final name. Note: **the domain is compiled into the app's Android manifest**, so changing it later needs a new build |
| O3 | Read receipts, letter-to-self, editing until delivery, immutable after delivery, delete-for-me, single recipient, no anonymous letters, 13+ age | Same as v1 (D5–D13) |
| O4 | Minimum Android | API 26 (Android 8.0) |
| O5 | Monetization | Out of MVP |

---

## 3. Technology architecture

### 3.1 Stack

| Concern | Choice |
|---|---|
| Language | **TypeScript** (strict mode) |
| App framework | **React Native + Expo** (current stable SDK at project creation), "Continuous Native Generation" (`expo prebuild`), **development builds** with EAS Build. No bare workflow unless forced |
| Navigation | **Expo Router** (file-based; deep links and notification taps map directly to routes) |
| Server state | **TanStack Query** (+ Supabase Realtime subscription to invalidate the inbox) |
| Client/UI state | **Zustand** (small: current language, compose UI state) |
| Forms & validation | **react-hook-form + zod** |
| Local storage | **expo-sqlite** for offline drafts; **expo-secure-store** for the auth session key (see note below) |
| i18n | **i18next + react-i18next + expo-localization** (plurals via `Intl.PluralRules`, Arabic has 6 plural forms) |
| Styling | React Native `StyleSheet` + own theme tokens, **logical (start/end) style properties only** — an ESLint rule bans `left/right/marginLeft/paddingRight…` |
| Fonts | `expo-font` + Google Fonts packages with **Arabic and Latin** families (see §3.8) |
| Dates | `Intl.DateTimeFormat` (Hermes supports Intl on Android) + `date-fns` where helpful |
| Backend | **Supabase**: Auth, Postgres + RLS, Edge Functions (Deno/TypeScript — same language as the app), `pg_cron`, Realtime, Storage |
| Push | `expo-notifications` + **Expo Push Service**; Edge Function sends and processes receipts |
| Testing | Jest + `jest-expo` + React Native Testing Library; **pgTAP** for RLS; **Maestro** for end-to-end flows |
| CI/CD | GitHub Actions (typecheck, lint, test, pgTAP) + **EAS Build/Submit/Update** |
| Types | `supabase gen types typescript` → DB types in the app; one `design-catalog.json` shared by app + DB validation |

Notes for an experienced RN developer:
- **Expo Go is not enough.** Push notifications on Android, Google Sign-In (native SDK) and some fonts/locale behavior need a **development build**. I'll set up the EAS dev build in Phase 1 to avoid late surprises.
- Supabase's session JSON exceeds SecureStore's per-value size limit on some devices, so we use the standard pattern: encrypt session with a key held in SecureStore, store ciphertext in AsyncStorage/SQLite.
- Windows is fine for Android. **iOS can later be built in the cloud with EAS — no Mac needed** for builds (a Mac/simulator is only convenient for debugging).

### 3.2 System diagram

```
┌────────────────────── Mobile app (Expo / React Native / TS) ──────────────────────┐
│ Expo Router screens → hooks/TanStack Query → repositories → Supabase JS client     │
│ i18n (ar/en) + RTL manager   LetterRenderer   expo-sqlite (drafts)   notifications │
└──────────────────────────────────┬─────────────────────────────────────────────────┘
                                   │ HTTPS + JWT (anon key + user session)
┌──────────────────────────────────▼─────────────────────────────────────────────────┐
│ Supabase                                                                             │
│  Auth │ Postgres + RLS + RPC (security definer) │ Realtime │ Storage (later)         │
│                                                                                      │
│  pg_cron (every minute) → deliver_due_letters() → notification_outbox               │
│  Edge Function "send-notifications" (reads outbox, localizes ar/en) ──► Expo Push   │
│  Edge Function "delete-account"                                       Service ──► FCM│
└──────────────────────────────────────────────────────────────────────────► Android │
                                                                            (later APNs → iOS)
```

### 3.3 Scheduled-delivery mechanism

1. Client calls RPC `send_letter(letter_id, scheduled_at?)`.
2. Server validates: sender owns the draft; recipient exists; **sender is allowed to write to recipient** (§3.6 rules); not blocked; body non-empty and ≤ limit; `scheduled_at` in the future (≤ 5 years); rate limit OK.
3. Status → `scheduled` with `scheduled_at` (**send-now uses `scheduled_at = now()`**).
4. `pg_cron` runs every minute → `deliver_due_letters()`: selects due rows `FOR UPDATE SKIP LOCKED`; **re-checks permission** (blocked? recipient now invite-only and sender not allowed? account deleted?). Allowed → `delivered`, sets `delivered_at`, inserts an outbox row. Not allowed → `undeliverable` (recipient never sees it; sender sees a neutral "Could not be delivered" without the reason, so block status isn't leaked).
5. Edge Function `send-notifications` claims pending outbox rows, builds the notification **in the recipient's `locale`**, calls Expo Push API in batches, checks **push receipts**, deletes tokens reported `DeviceNotRegistered`, retries with backoff.
6. If the app is open, Realtime updates the inbox instantly.
7. Notification tap → Expo Router deep link `/letter/{id}`.

Accuracy target: within ~1 minute. In-app inbox is the source of truth; push is a hint (OEM battery savers can delay it).

### 3.4 Letter design system
- Design = versioned JSON: `{ v, paper, font, ink, layout, stamp, stickers[] }`. Catalog in **`design-catalog.json`** (single source of truth): each entry has `key`, asset, and for fonts a **`scripts: ["latin","arabic"]`** list.
- Server validates keys/version only (Postgres function + zod on client). Unknown key/version on an older app → fallback design.
- **Font/script rule:** the composer only offers fonts that support the letter's script; if body is Arabic and the chosen font has no Arabic glyphs, the renderer falls back to the paper's paired Arabic font. Mixed Arabic/English text renders with fallback per glyph.
- MVP papers are colors/gradients/bundled images; heavy effects (Skia textures, export as image via `react-native-view-shot`) come later.

### 3.5 Internationalization & RTL architecture ⭐ (biggest change)

**Principles**
1. **Language and direction are separate from the letter's direction.** UI direction follows the app language; a *letter* has its own direction (`body_dir`) so an Arabic letter looks the same to an English-UI recipient and vice versa.
2. **All user-visible strings live in `ar.json` / `en.json`.** No string literals in components (lint rule).
3. **Logical layout only** (start/end, `flexDirection: 'row'` auto-flips in RTL). Directional icons (back arrow, chevrons, send) are mirrored by an `<DirectionalIcon>` wrapper.

**Runtime language switching without separate builds**
- Settings → Language: **System / English / العربية**. Default: device language if `ar` or `en`, else `en`.
- Flow: `i18n.changeLanguage()` → `I18nManager.allowRTL(true)` + `forceRTL(isRtl)` → persist choice (local + `profiles.locale`) → **app restart** via `expo-updates` `reloadAsync()` (production) / `DevSettings.reload()` (dev). React Native's layout direction is decided at app start, so a confirmed reload is required when direction changes (en ↔ ar). Language-only changes within the same direction need no restart. This is standard and needs no separate builds.
- `app.config` sets `supportsRtl: true` and the `expo-localization` plugin's supported locales, so the OS also knows the app supports Arabic (system per-app language setting on Android 13+).

**Letter text direction**
- On save, compute `body_dir` = direction of the first strong character (Arabic range → `rtl`, Latin → `ltr`, default = sender's UI direction). Store it in the letter. Renderer and composer use it for text alignment/`writingDirection`. Mixed-script text is handled by the platform bidi algorithm; we test numbers, punctuation and Latin words inside Arabic sentences.
- ⚠️ I will run an **early technical spike (Phase 1)** on a real Android device to verify: multiline `TextInput` behavior with Arabic/Latin mixed text, cursor/alignment, keyboard switching, and the Android date/time picker's language (native pickers usually follow the *device* locale, not the app language — if so, we build a small custom picker to keep Arabic/English consistent).

**Other i18n items**
- Plurals and counts via i18next (`_zero/_one/_two/_few/_many/_other` for Arabic).
- Dates/times via `Intl` with the active locale; scheduled times shown in the user's **device time zone**, stored as UTC.
- **Push notifications localized server-side** using `profiles.locale` (falls back to `en`). Server errors return **error codes**, never display text; the app maps codes to translated messages.
- Legal pages, store listing, and error messages exist in both languages.
- Testing: every screen verified in EN/LTR and AR/RTL; snapshot tests run in both; a pseudo-long-text pass for overflow; a checklist of mirrored icons/gestures/animations.

### 3.6 Discovery, invites and receive rules

**Finding a user**
| Method | Behavior |
|---|---|
| Username search | RPC `search_users(q)` — prefix match via `pg_trgm`/`citext` index, q ≥ 3 chars, ≤ 20 rows, only `discoverable_by_username = true`, excludes self and users who blocked the caller. Returns only `id, username, display_name, avatar_key, receive_mode` |
| Email lookup | RPC `find_user_by_email(email)` — `SECURITY DEFINER`, exact (case-insensitive) match on **verified** `auth.users.email`, only if `discoverable_by_email = true`. Same empty response for "no such user" and "not discoverable". Rate-limited (e.g. 10/hour/user). Never returns the email |
| Invite link / QR | `https://<domain>/i/<code>` (dev: `letterapp://invite/<code>`). Opening in the app calls `redeem_invite(code)` |

**Can A write to B?** (evaluated at send **and** at delivery)
1. A ≠ blocked by B (and B ≠ blocked by A) — else no.
2. If A = B → yes (letter to self).
3. If the letter is a **reply** to a delivered letter that A received from B → yes.
4. If `B.receive_mode = 'everyone'` → yes.
5. If `B.receive_mode = 'invite_only'` → only if an **accepted `connections` row** between A and B exists.
6. Otherwise → no. In search results, invite-only users show **"Send connection request"** instead of "Write letter".

**Connections (DEC-007, accepted):** mutual pen-pal link. Redeeming B's invite creates it already `accepted`; a request from search/profile creates it `pending` until B accepts/declines. Pending requests cannot send letters. Either side can remove the connection; blocking deletes it and any pending requests. No free-text message in requests. *Provisional numbers (final in Phase 2/5): 30-day re-request cooldown, ≤ 20 outstanding requests, daily request rate limit.*

**Invites:** each user has one active invite code (regenerate = revoke the old one), optional expiry and max-uses later. Codes are random 10-char base32 (not guessable). Redeeming is idempotent.

### 3.7 Temporary naming strategy (R14)

Everything that carries the name comes from **one file**, `mobile/brand.config.ts` (+ env vars):

| Item | Dev value (temporary) | Changeable? |
|---|---|---|
| Display name | `LetterApp` (also in `en.json`/`ar.json` under `app.name`, so Arabic can be a different localized name) | Anytime |
| Expo `slug` / scheme | `letterapp` | Before production; deep links must be retested |
| Android `applicationId` | Variant-based: `<reverse.domain>.letterapp.dev` (dev), `.preview`, and final one for production | **Dev/preview: freely. Production: must be frozen before the first Play upload — it is permanent afterward.** Note: Play rejects `com.example.*` |
| Deep-link / invite domain | temporary | Compiled into the manifest → needs a new build if changed |
| Supabase project name | any | Independent of app name |
| Firebase/FCM project (push credentials) & Google OAuth client | Tied to the **package name + signing SHA-1** | Must be recreated if the package ID changes → do it after the naming freeze |

Rule: **"Naming freeze" gate before Phase 10 (release)**: choose final name, package ID, domain, then regenerate credentials. Until then, dev builds using the temporary ID are throwaway.

### 3.8 Fonts
Latin: e.g. Caveat, Playfair Display, Lora. Arabic: e.g. Cairo, Tajawal, Amiri, Noto Naskh Arabic, Aref Ruqaa (calligraphic). Final list decided in Phase 4 after checking licenses (Google Fonts/OFL is fine for embedding) and how they render on Android.

---

## 4. Database model (PostgreSQL / Supabase)

Enums: `letter_status` = `draft | scheduled | delivered | undeliverable`; `receive_mode` = `everyone | invite_only`; `text_dir` = `ltr | rtl`; `app_locale` = `en | ar`.

### 4.1 Tables

**`profiles`** (1:1 with `auth.users`)
| column | type | notes |
|---|---|---|
| id | uuid PK | = `auth.users.id` |
| username | citext unique | `^[a-z][a-z0-9_]{2,19}$`, no `__`, no trailing `_`, reserved-word blocklist; plus `username_skeleton` (look-alike-normalized) with its own **unique index** (DEC-010) |
| display_name | text | any Unicode, ≤ 50 |
| avatar_key | text null | preset icon key (MVP) |
| **locale** | app_locale | UI language, used for push |
| **receive_mode** | receive_mode | default **`invite_only`** |
| **discoverable_by_username** | bool | default true |
| **discoverable_by_email** | bool | default **false** |
| read_receipts_enabled | bool | default true |
| created_at / deleted_at | timestamptz | |

**`invites`**
`id, owner_id → profiles, code (unique, 10-char base32), created_at, revoked_at null, expires_at null, max_uses null`. One active (non-revoked) invite per owner (partial unique index).

**`connections`** — mutual pen-pal links and requests (DEC-007)
`id, requester_id, addressee_id, status ('pending'|'accepted'|'declined'), via ('invite'|'request'), invite_id null, created_at, responded_at null` — unique on the **unordered** pair (`least(a,b), greatest(a,b)`); declined rows kept for the 30-day cooldown. Only `accepted` grants sending rights. Written only via RPC.

**`username_history`** — `user_id, old_username, old_skeleton, released_at, reserved_until` (old name reserved 90 days for the previous owner; username change ≤ once per 30 days).

**`letters`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| sender_id, recipient_id | uuid → profiles | recipient null while draft w/o recipient |
| thread_id | uuid | root letter id |
| parent_letter_id | uuid null | for replies |
| subject | text null | ≤ 120 |
| body | text | ≤ 10,000 |
| **body_dir** | text_dir | detected on save, renders identically for both sides |
| design | jsonb | versioned design (validated) |
| status | letter_status | |
| scheduled_at | timestamptz null | UTC |
| delivered_at, read_at | timestamptz null | |
| sender_deleted_at, recipient_deleted_at | timestamptz null | delete-for-me |
| created_at, updated_at | timestamptz | |

Constraints: scheduled ⇒ `scheduled_at` not null; non-draft ⇒ `recipient_id` not null; delivered letters immutable (trigger); replies must reference a delivered parent addressed to the sender.
Indexes: inbox `(recipient_id, delivered_at desc) where status='delivered'`; sender lists `(sender_id, status, updated_at desc)`; **partial `(scheduled_at) where status='scheduled'`** for cron; `(thread_id, created_at)`.

**`devices`** — `id, user_id, push_token (Expo token, unique), platform, locale, app_version, last_seen_at, created_at`.

**`notification_outbox`** (server-only) — `id, user_id, letter_id, type, status ('pending'|'sent'|'failed'), attempts, next_attempt_at, expo_ticket_id, sent_at, error, created_at`.

**`blocks`** — `blocker_id, blocked_id, created_at` (PK pair). Blocking deletes any connection/pending request between the two users.

**`reports`** — `id, reporter_id, letter_id, reason, details, status, created_at`.

**`api_rate_limits`** — `user_id, action ('search_users'|'find_email'|'send_letter'|'redeem_invite'), window_start, count` — used by RPCs.

**Later:** `attachments` + Storage buckets (private, signed URLs), `letter_recipients` (multiple), `subscriptions`.

### 4.2 RPCs (all `SECURITY DEFINER` where they must bypass RLS; each checks `auth.uid()`)
`search_users(q)` · `find_user_by_email(email)` · `get_or_create_invite()` · `regenerate_invite()` · `redeem_invite(code)` · `send_letter(id, scheduled_at)` · `unschedule_letter(id)` · `mark_read(id)` · `delete_letter_for_me(id)` · `block_user(id)` / `unblock_user(id)` · `update_receive_settings(...)`.

### 4.3 Letter lifecycle
```
 [draft] ──send_letter──► [scheduled] ──cron @ scheduled_at──► [delivered] → read_at
    ▲                          │                                    (immutable)
    └──── unschedule ──────────┤
                               └─ recheck fails (blocked / invite-only / deleted) ─► [undeliverable]
 Recipient replies → new letter with parent_letter_id + same thread_id
```
Local device: `expo-sqlite` table `local_drafts(id, body, subject, design, recipient_id, dirty, updated_at)`; last-write-wins sync to `letters` (`status='draft'`).

---

## 5. Application structure

```
letters/
├─ docs/                      PLAN.md, DECISIONS.md, ARCHITECTURE.md
├─ shared/
│  └─ design-catalog.json     single source of truth for papers/fonts/inks/stamps
├─ mobile/                    Expo project
│  ├─ app.config.ts, brand.config.ts, eas.json
│  ├─ app/                    Expo Router routes
│  │  ├─ _layout.tsx          providers: i18n, query, auth gate, direction
│  │  ├─ (auth)/              sign-in, sign-up, onboarding (username, language, discoverability)
│  │  ├─ (tabs)/              inbox, drafts, sent, profile
│  │  ├─ compose/             compose, pick-recipient, pick-design, schedule
│  │  ├─ letter/[id].tsx      reading view + reply
│  │  ├─ thread/[id].tsx
│  │  ├─ invite/[code].tsx    redeem invite (deep-link target)
│  │  └─ settings/            language, privacy (receive mode, discoverability), blocked, delete account
│  ├─ src/
│  │  ├─ core/                theme tokens, i18n (ar.json, en.json), rtl manager, env, errors
│  │  ├─ data/                supabase client, db types, repositories, sqlite drafts store
│  │  ├─ domain/              pure TS: types, validation (zod), permission rules, direction detection
│  │  ├─ features/            auth, compose, drafts, inbox, sent, letter, discovery, invites,
│  │  │                       notifications, safety, settings, designs (LetterRenderer)
│  │  └─ components/          DirectionalIcon, Screen, Button, TextField (RTL-aware)
│  ├─ assets/                 fonts, papers, stamps
│  └─ __tests__/ , .maestro/
├─ supabase/
│  ├─ migrations/             schema, RLS, RPCs, cron (source of truth)
│  ├─ functions/              send-notifications, delete-account
│  └─ tests/                  pgTAP RLS/RPC tests
└─ .github/workflows/
```

Layering: **screens → hooks → repositories (interfaces) → Supabase**. `domain/` has no React or Supabase imports (permission rules and direction detection are pure, unit-testable functions). Platform-specific bits (notifications, deep links, language switching) sit behind small modules so iOS is configuration, not redesign.

### MVP screens
Auth → onboarding (username, language, "let people find me by email?") → Tabs (Inbox · Drafts · Sent/Scheduled · Profile) → Compose (text, design, recipient search/paste-invite, schedule) → Letter view + Reply → Thread → Settings (language, receive mode, discoverability, invite link/QR share, blocked users, delete account, privacy policy).

---

## 6. Security model

### 6.1 Principles
1. Client is untrusted — every rule enforced by **RLS + RPC/Edge Functions**.
2. Only the anon key ships in the app. **`service_role` and Expo access token live only in Edge Function secrets.**
3. **Default deny**: RLS on every table; no direct client writes to status, `delivered_at`, or `connections`.

### 6.2 RLS summary
| Table | Access |
|---|---|
| profiles | Read own full row; others' data only via `search_users`/`find_user_by_email`/joins exposing public fields. Update own display name/locale/settings (column-limited) |
| letters | **SELECT:** sender sees own (all statuses); recipient only `status='delivered'` and `recipient_deleted_at is null`. **INSERT/UPDATE:** sender only on own `draft` rows; all state transitions via RPC. Recipient may change only `read_at` / `recipient_deleted_at` via RPC. Delivered = immutable |
| invites | Owner reads own; `redeem_invite` is the only way to look up by code |
| connections | Either party reads own rows; all writes (request, accept, decline, unpair) only via RPC |
| devices | Owner only |
| notification_outbox, api_rate_limits | No client access |
| blocks | Owner only |
| reports | Insert own; read admin-only |

### 6.3 Auth
Email + password (verified) and **Google Sign-In** (native SDK, via development build). Apple Sign-In added with iOS (Apple requires it when other social logins exist). Session encrypted at rest (§3.1). Auth endpoints rate-limited by Supabase.

### 6.4 Discovery-specific protections
- Email lookup: opt-in, exact match, verified emails, identical responses for miss/hidden, rate-limited, email never returned, no email in logs.
- Username search: min length, result cap, rate limit, no wildcard-only queries, hides users who blocked the caller and users with discoverability off.
- Invite codes: high entropy, revocable, redemption rate-limited, no user info exposed before redemption beyond the owner's public profile.
- Neutral failure messages to avoid confirming blocks or account existence.

### 6.5 Data protection & privacy
- TLS everywhere; encryption at rest by Supabase. **Not end-to-end encrypted in MVP** (breaks moderation, multi-device, recovery) — stated plainly in the privacy policy (Arabic + English).
- **Push payload has no letter text**: only a localized generic line such as "You have a new letter from {name}" (setting to hide sender on lock screen) plus `letter_id`. Because Expo Push Service relays the message, this also keeps content away from the relay.
- Account deletion flow (Edge Function): anonymize profile, delete drafts/devices/invites/connections; delivered letters remain for recipients with sender shown as "Deleted user".
- No letter body in logs or crash reports. Release build with Hermes + minification; Play Integrity / App Check later.
- Secrets in EAS secrets / Supabase secrets; `.env` git-ignored from day one.

### 6.6 Automated threat tests (pgTAP, must pass in CI)
- Read another user's draft/scheduled letter by ID → nothing.
- Recipient reads a scheduled letter early → nothing.
- Insert letter as `delivered` or with someone else's `sender_id` → rejected.
- Send to an **invite-only** user without an accepted connection → rejected; with one → OK; pending/declined request → rejected; after block → rejected; look-alike usernames (`paypa1`/`paypal`, `a_b`/`ab`) → rejected.
- Schedule → recipient switches to invite-only / blocks before delivery → letter becomes `undeliverable`, **no notification**.
- Email lookup: miss and hidden return identical results; email never in any response.
- User enumeration by short/wildcard username query → rejected.
- Redeem revoked/expired/unknown invite → identical generic error.
- Modify delivered letter → rejected. 1000 sends/minute → rate-limited.
- Cron function run twice concurrently → still exactly one delivery/notification per letter.

---

## 7. MVP scope

### IN
- Email + Google sign-in, unique Latin username, display name (Unicode), preset avatar, onboarding (language, discoverability)
- **Arabic + English UI, RTL/LTR, runtime language switch, localized push notifications, Arabic-capable design fonts**
- Compose plain-text letters (subject + body), autosave drafts (offline-capable), bidi-aware editor
- Design v1: ~6 papers, ~5 fonts incl. Arabic ones, ~8 inks, ~4 stamps; live preview
- **Find users by username and by email (opt-in); share invite link/QR/code; redeem invites; pen-pal connection requests (accept/decline/remove — DEC-007); receive setting Everyone / Invite-only (default Invite-only)**
- Send now / schedule (date+time, UTC), cancel/edit until delivered, letter to self
- Inbox, reading view, reply, threads, sent/scheduled list with status
- Push notification on delivery + deep link; Android 13+ permission flow
- Block, report, delete-for-me, account deletion, settings, privacy policy/ToS (ar/en)
- Crash reporting (Sentry for RN) and opt-in analytics

### OUT (v1.1+)
Rich text · images/attachments & user-uploaded avatars (Storage) · multiple recipients · invite non-users with deferred deep links · contact sync · Hijri calendar / Arabic-Indic digits toggle · premium designs · E2EE · web client · iOS release · Skia paper textures/export as image · more languages · admin moderation dashboard.

### Definition of done
- Two Android devices (one Arabic/RTL, one English/LTR) with two accounts: search by username → send; email lookup works only when opted in; invite link redeemed by an invite-only user; schedule 2 minutes ahead, close app, receive **localized** push, open, reply, sender gets it.
- Switching language en↔ar restarts cleanly and every screen is verified in both directions.
- §6.6 tests pass in CI. Signed AAB accepted on Play **internal testing**.

---

## 8. Implementation plan

Size: **S** ≈ hours · **M** ≈ 1–2 days · **L** ≈ several days (part-time pace).

**Phase 0 — Decisions & environment (S)**
Confirm §2.2. Install Node LTS, JDK, Android Studio (SDK + emulator), Git; create Expo (EAS), Supabase, Google Cloud/Firebase (Google sign-in + push credentials) accounts. `git init`, `.gitignore`, `CLAUDE.md`, `docs/DECISIONS.md`.
*Exit:* tools verified; repo under git.

**Phase 1 — Foundation + i18n/RTL spike (M)**
Expo TS project, Expo Router, `brand.config.ts` + dev/preview/prod variants, ESLint (incl. no-left/right rule, no-hardcoded-strings), Prettier, tsc strict, Jest. i18n with `ar/en`, RTL manager, theme tokens, DirectionalIcon, **EAS development build on a real device**. **Spike:** bidi `TextInput`, mixed-script rendering, Arabic fonts, native date picker language, language-switch-and-reload. CI (lint, typecheck, test).
*Exit:* app shell with tabs runs in both languages/directions on a device; spike findings recorded in `docs/DECISIONS.md` (may change §3.5 details).

**Phase 2 — Auth & profiles (M)**
Migration: `profiles`, enums, trigger on sign-up, RLS. Sign up/in (email + Google), verification, reset, session encryption, onboarding (username with availability check, display name, language, email-discoverability choice), sign-out.
*Exit:* two accounts on two devices; pgTAP for `profiles`.

**Phase 3 — Letters core: drafts (L)**
Migration: `letters` + constraints/indexes/RLS. `body_dir` detection (pure function + tests). Repository, `expo-sqlite` draft store, debounced autosave, drafts list, edit/delete.
*Exit:* offline drafts sync when online; RLS tests for drafts.

**Phase 4 — Design system & renderer (M–L)**
`design-catalog.json`, `LetterRenderer` (direction- and script-aware), design picker with live preview, validation (zod + Postgres), fallbacks, font/script handling, snapshot tests in ar/en.
*Exit:* same letter renders identically in preview and reading view, in both UI directions.

**Phase 5 — Discovery & invites (M–L)**
Migration: `invites`, `connections`, `api_rate_limits`, `blocks` (basic), RPCs from §4.2 and rules from §3.6 as a single shared SQL function `can_send(sender, recipient, parent)`. Search UI (username/email), connection requests inbox (accept/decline/cancel/remove — DEC-007), invite link/QR/code share + manual code entry, deep link `invite/[code]`, receive-mode + discoverability settings. (Username skeleton/reserved-word/history rules from DEC-010 land in Phase 2.)
*Exit:* invite-only flow works end to end; pgTAP tests for permissions and enumeration resistance.

**Phase 6 — Sending, scheduling, delivery (L)** ⟵ riskiest
`send_letter`/`unschedule_letter`, `deliver_due_letters()` with re-check + `undeliverable`, `pg_cron`, outbox, schedule picker (time zone), sent/scheduled screens, inbox, reading view, mark read, Realtime.
*Exit:* schedule 2 minutes ahead → appears exactly once; permission-change-before-delivery test passes; concurrent-run test passes.

**Phase 7 — Push notifications (M)**
`expo-notifications`, Android channel, Android 13 permission, device-token registration/refresh/cleanup, Edge Function `send-notifications` (localized ar/en, batching, receipts, retries), deep-link on tap. Requires FCM credentials uploaded to EAS.
*Exit:* push works foreground/background/killed; Arabic user receives Arabic text.

**Phase 8 — Replies & threads (M)**
Reply flow (prefilled recipient/thread/parent), server reply rules (allowed even for invite-only senders), thread view (direction-aware).
*Exit:* full back-and-forth including a scheduled reply.

**Phase 9 — Safety, privacy, settings (M)**
Block/unblock UI, report, delete-for-me, account deletion (Edge Function), privacy policy/ToS (ar/en), notification preferences.
*Exit:* full §6.6 checklist green.

**— Naming freeze gate —** final app name, package ID, domain; regenerate Google/FCM credentials; App Links `assetlinks.json`; landing page for invite links.

**Phase 10 — Hardening & release (M)**
Polish states (loading/empty/error/offline) in both directions, accessibility (TalkBack in Arabic, font scaling, contrast), performance for long letters, Sentry, icon/splash, Arabic + English store listing, Data Safety form, EAS production build, Play internal → closed testing → production.
*Exit:* on Play internal track; testers use it for a week without data-loss bugs.

**Phase 11 — iOS readiness (after MVP)**
Apple Developer account, EAS iOS build, APNs credentials, Sign in with Apple, iOS permission strings (Info.plist localized ar/en), RTL/bidi parity checks, universal links.

### Testing strategy
Unit (domain rules, direction detection, design validation, time-zone) · pgTAP (RLS, RPCs, cron idempotency — highest value) · component tests in both locales · Maestro E2E happy path (run once in `en`, once in `ar`) · manual device matrix: Android 8, 13, 14+; battery saver; app killed; airplane mode; system language ≠ app language.

### Key risks
| Risk | Mitigation |
|---|---|
| RTL/bidi glitches (text input, mixed scripts, icons, pickers) | Phase 1 spike on real device; logical styles enforced by lint; both-direction checklist per screen |
| Language switch requires restart | Confirmed reload with saved state; documented behavior |
| Permissions change between scheduling and delivery | Re-check at delivery; `undeliverable` status; tested |
| Email lookup abuse / enumeration | Opt-in default OFF, exact match, uniform responses, rate limits |
| Package ID/domain/credentials tied to temporary name | Variants + naming freeze gate; never publish under temp IDs |
| Expo Go limitations | Development builds from Phase 1 |
| Push delayed by OEM battery savers | Inbox is source of truth; help text |
| Vendor dependency (Expo Push Service, Supabase) | Token abstraction in `devices`; SQL migrations in git; repository interfaces |
| Spam/abuse | Receive modes, blocks, reports, rate limits, no uploads in MVP |
| Arabic copy quality | MSA glossary, native-speaker review before release |

---

## 9. Working together in Claude Code
1. Confirm §2.2 (short answers are fine).
2. One phase at a time: I propose steps → you approve → small commits.
3. `CLAUDE.md` will hold stack, commands (`npx expo start`, `npm test`, `supabase db reset`), conventions (logical styles, no hard-coded strings, RLS on every table, no secrets).
4. Use Plan mode for architecture decisions; normal mode for implementation.
5. After each step: run it, on device, in both languages.

## 10. Next steps
1. You confirm/correct I1–I11.
2. I create `docs/DECISIONS.md` and `CLAUDE.md`, plus the exact Phase 0 install checklist for Windows.
3. Phase 1 begins only when you say go.
