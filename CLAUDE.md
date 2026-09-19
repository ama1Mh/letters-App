# CLAUDE.md — LetterApp (temporary name)

Digital letter-writing app: create letters, save drafts, send now or schedule, receive/reply, customize letter design, get notified on delivery. Android first, iOS later. **Arabic + English (RTL/LTR) from day one.**

## Project status
**Planning only (Phase 0). No application code exists.** Do not scaffold or implement anything until the owner says "go" for a specific phase. This directory is a git repository (working branch `dev`, remote `origin`).

## Read first
1. `docs/DECISIONS.md` — **authoritative** decisions. If it conflicts with `docs/PLAN.md`, DECISIONS.md wins.
2. `docs/PLAN.md` — architecture, DB model, security model, phases.
3. `docs/PHASE0_CHECKLIST.md` — Windows setup state.

## How to work with the owner
- The owner is experienced with React Native, new to Claude Code. Explain Claude Code mechanics briefly when relevant; don't explain RN basics.
- **One phase at a time.** Before each phase: propose the steps, wait for approval, then implement in small commits. Stop at each phase's exit criteria and show what exists.
- Ask before: installing global tools, creating cloud resources, running anything destructive, changing a decision in `DECISIONS.md`, or expanding MVP scope.
- Anything marked **Needs confirmation** or **Open** in `DECISIONS.md` must be confirmed before building on it.
- Never ask the owner to paste secrets into chat. Secrets go in `.env` files (git-ignored), EAS secrets, or Supabase secrets.
- When you change a decision or discover something in a spike, record it in `docs/DECISIONS.md` (with date) in the same change.

## Stack (see DECISIONS.md DEC-002/003/004)
React Native + Expo (current stable SDK) + **TypeScript strict** · Expo Router · TanStack Query · Zustand · react-hook-form + zod · expo-sqlite (offline drafts) · expo-secure-store · i18next + expo-localization · Supabase (Auth, Postgres/RLS, Edge Functions in Deno/TS, pg_cron, Realtime) · Expo Push Service · Jest + RNTL · pgTAP · Maestro · EAS Build.
Use **development builds**, not Expo Go, for anything touching push, Google Sign-In, or native modules.

## Planned layout (does not exist yet)
```
docs/            PLAN.md, DECISIONS.md, PHASE0_CHECKLIST.md, ARABIC_REVIEW.md (Phase 1)
shared/          design-catalog.json, avatar-catalog.json  (used by app AND DB validation)
mobile/          Expo project (app/ routes, src/{core,data,domain,features,components})
supabase/        migrations/, functions/, tests/ (pgTAP)
```
`domain/` is pure TypeScript (no React, no Supabase imports): permission rules, direction detection, username/display-name validation, design validation.

## Commands
Not valid until Phase 1 creates the project. Planned: `npx expo start`, `npx expo run:android` / EAS dev build, `npm test`, `npm run lint`, `npm run typecheck`, `npx supabase db reset`, `npx supabase test db`. **Replace this section with the real, verified commands at the end of Phase 1.**

## Hard rules

### Localization / RTL
- **No hard-coded user-visible strings.** Everything goes through i18n (`en.json` + `ar.json`). Add both languages in the same change.
- **Logical styles only:** `marginStart/End`, `paddingStart/End`, `start/end`, `textAlign: 'auto'|'start'`. Never `left/right/marginLeft/paddingRight`… (ESLint enforces). Directional icons use `<DirectionalIcon>`.
- Arabic = **Modern Standard Arabic**, **Western digits (0–9)**, **Gregorian calendar**. Format dates/numbers via `Intl` with explicit `ar-u-ca-gregory-nu-latn` / `en-u-ca-gregory-nu-latn`. Never rely on the bare device locale.
- Arabic strings you write are **provisional** — list them in `docs/ARABIC_REVIEW.md` as `draft`. Only the owner marks `approved`. Release gate: no `draft` strings.
- A letter's direction is stored (`body_dir`) and independent of UI language. `@username` is always rendered LTR (isolate) inside RTL UI.
- Every screen/component change is checked in **EN/LTR and AR/RTL**. Direction changes require an app reload; same-direction language changes don't.
- Errors from the server are **codes**; the app maps codes to translated text. Push text is localized server-side from `profiles.locale`.

### Security / database
- **RLS enabled on every table, default deny.** All schema, RLS, RPCs and cron live in `supabase/migrations/` — never change the database by hand.
- The client uses only the anon key. **`service_role` key and Expo access token never enter the app** (Edge Function secrets only).
- Clients cannot write letter `status`, `delivered_at`, or `connections` directly — only via RPC. Delivered letters are immutable.
- **Send permission = `can_send()`** (DEC-007, accepted), evaluated at send **and** at delivery. Blocking/reporting work regardless of `receive_mode`. `everyone` → no connection needed; `invite_only` → accepted connection required; pending requests never grant sending; replies always allowed unless either side blocked.
- Connections come only from invite redemption (auto-accepted) or request + accept; either side can remove; blocking removes connection + pending requests.
- The 30-day decline cooldown, 20-pending cap, request/search rate limits and username-change limits are **provisional** (OPEN-5): keep them as named config constants, not scattered literals, until finalized in Phase 2/5.
- Defaults: `receive_mode = invite_only`, `discoverable_by_email = false`, `discoverable_by_username = true`.
- **Email search:** exact match, opt-in, verified emails only, identical response for "no account" / "hidden", email never returned or logged, rate-limited. Never read `auth.users` from the client.
- **Usernames:** `[a-z0-9_]{3,20}`, start with a letter, case-insensitive unique, plus unique **skeleton** index (look-alike protection), reserved list, change limits (DEC-010). **Display names:** strip bidi/zero-width/control characters; always show `@username` beside them.
- Never log letter bodies, emails, tokens, or invite codes. No secrets in git; `.env*` git-ignored from the first commit.
- Neutral failure messages that don't reveal blocks or account existence.
- Every RLS/permission change ships with a **pgTAP test** (threat list in PLAN.md §6.6).

### Product / architecture
- Avatars: **preset icons only**; use the `<Avatar source>` union so images can be added later (DEC-011). No Storage buckets in MVP.
- Invite links use the scheme from `brand.config.ts` (dev: `letterapp://invite/<code>`). **No production domain until the naming freeze.**
- **Never hard-code the app name, slug, scheme, package ID, or domain** — use `brand.config.ts` / build variants (DEC-001). Never publish under temporary IDs.
- Scheduled delivery is server-side only (pg_cron + outbox). No local alarms for delivery.
- Push payloads never include letter text.
- MVP scope is fixed by `docs/PLAN.md` §7 + `DECISIONS.md`. Out-of-scope ideas go to the backlog, not the code.

### Code quality
- TypeScript strict, no `any` without a comment. Generated Supabase types (`supabase gen types`), not hand-written DB types.
- Definition of done for any change: typecheck + lint + tests pass, works in **both languages/directions**, and (for UI) verified on a device/emulator.
- Match surrounding code style; small focused commits.

## Environment (this machine)
- Windows 11, PowerShell primary (Git Bash available). Project path is short (`D:\dev\tab\letters`) — keep it that way (Windows path-length issues with Android builds).
- Use `.gitattributes` with LF line endings for source files when the repo is initialized.
- Android SDK is at `D:\APPS\Android\Sdk` (`ANDROID_HOME` / `ANDROID_SDK_ROOT`, env vars already set); AVDs are stored at `D:\APPS\Android\avd` (`ANDROID_AVD_HOME`). Current setup state and to-dos: `docs/PHASE0_CHECKLIST.md`.
