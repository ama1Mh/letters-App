# Vintage letter editor: implementation assessment (Phase 12)

Status: **assessment only, nothing implemented.** Written 2026-10-01 from the owner's
"new letter-design direction" brief. Decisions proposed here are recorded as **DEC-060 (Needs
confirmation)** and **OPEN-13** in `DECISIONS.md`; nothing below is built until the owner approves.

Concept: **the letter is a visual canvas.** Workflow: choose paper → write → decorate → arrange → send.
First stage proves the mechanics with a small catalog (3 papers, 3 stamps, 3 stickers, 2 postmarks).
The critical end-to-end test: **place → move → resize → rotate → save → send → receive → reopen**, and
the recipient sees the same composition.

---

## 1. What already exists

| Area             | Today                                                                                                                                                                                                                                                                                                                                                      | Where                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design catalog   | `shared/design-catalog.json` v1: 6 flat-colour papers, 5 fonts with `scripts`, 8 inks, 4 stamps (Ionicons glyphs), per-script fallback fonts, defaults                                                                                                                                                                                                     | `shared/design-catalog.json`                                                                                                                          |
| Design model     | `{ v:1, paper, font, ink, layout:'standard', stamp: key\|null, stickers: [] }` (zod). `stickers` is reserved and must be empty. `normalizeDesign()` never throws: anything invalid becomes the default                                                                                                                                                     | `mobile/src/domain/design.ts`                                                                                                                         |
| Font/script rule | `fontsForDirection(bodyDir)`, `resolveFont()` falls back per script                                                                                                                                                                                                                                                                                        | `design.ts`                                                                                                                                           |
| Renderer         | `LetterRenderer`: paper colour, ink, resolved font, one stamp icon in the top-end corner, subject + body with `writingDirection = bodyDir`, per-font optical scale; sizes follow the system font scale                                                                                                                                                     | `src/features/designs/LetterRenderer.tsx`                                                                                                             |
| Editor           | Compose screen = subject/body `TextInput`s + a live `LetterRenderer` preview below + "Change design" → separate design-picker screen (taps save immediately)                                                                                                                                                                                               | `app/compose/[id].tsx`, `app/compose/pick-design.tsx`                                                                                                 |
| Fonts            | Caveat, Playfair Display, Cairo, Tajawal, Amiri via `@expo-google-fonts/*`                                                                                                                                                                                                                                                                                 | `useDesignFonts.ts`                                                                                                                                   |
| DB               | `letters.design jsonb`, CHECK `is_valid_design()` with literal key lists mirrored from the catalog; v1 default as column default; the delivered-immutability trigger already freezes `design`; list/read functions already return `design`                                                                                                                 | `20260924120000_letters.sql`, `20260924180000_letters_design_validation.sql`, `20260925150000_letters_sending.sql`, `20260927090000_letter_lists.sql` |
| Offline drafts   | SQLite `local_drafts.design` is **opaque JSON text**, synced as-is, last-write-wins per draft                                                                                                                                                                                                                                                              | `src/data/local/*`, `src/data/letters/draftsRepository.ts`                                                                                            |
| Reading          | Reading view and thread use `LetterRenderer` with `normalizeDesign(row.design)`                                                                                                                                                                                                                                                                            | `app/letter/[id].tsx`, `lettersRepository.ts`                                                                                                         |
| Gestures         | **`react-native-gesture-handler` 3.3.0, `react-native-reanimated` 4.7.0 and `react-native-worklets` 0.13.0 are already installed (pulled in by expo-router) and autolinked into the current dev build** (`PackageList.java`: `GestureHandlerPackage`, `ReanimatedPackage`, `WorkletsPackage`). Not yet direct dependencies. No `react-native-svg`, no Skia | `mobile/node_modules`, `mobile/android/.../PackageList.java`                                                                                          |
| Tests            | Jest/RNTL: `design.test.ts`, `LetterRenderer.test.tsx`, `pick-design.test.tsx`, `compose-design-integration.test.tsx`; pgTAP: `letters.test.sql`, `sending.test.sql`; Maestro `02-compose-draft.yaml`                                                                                                                                                      |                                                                                                                                                       |

## 2. What can be reused unchanged

- The whole send / schedule / deliver / Realtime / push / reply / delete-for-me / block pipeline. It moves
  `design` as an opaque column; push payloads and Realtime events never include it.
- RLS, grants, `can_send()`, the status-transition and **delivered-immutability triggers** (a delivered
  composition is already frozen, which is exactly what "recipient sees the same composition" needs).
- The offline drafts store and sync (design is opaque JSON; no SQLite schema change).
- The catalog-in-`shared/` + SQL-mirror convention, `normalizeDesign()`'s "never throw" contract,
  `fontsForDirection`/`resolveFont`, `bodyDir` handling, `useDesignFonts`, the optical-scale idea.
- The compose screen's load/autosave/send logic and the design picker's "every change saves" pattern.
- Generated Supabase types (`design` stays `Json`; no regeneration needed).

## 3. What needs to change

1. **Catalog v2** (`shared/design-catalog.json`): vintage papers with textures, physical inks, font
   `category`, and three new element catalogs (`stamps`, `stickers`, `postmarks`) whose entries point at
   bundled image assets plus a natural aspect ratio and default size. Limits (`maxElements`, scale and
   coordinate ranges) live in the catalog so app and SQL share one source.
2. **Design schema v2** in `design.ts` + a pure `upgradeDesignV1()`; old keys map to new ones.
3. **SQL**: a new migration replacing `is_valid_design()` to accept v1 (frozen, for existing rows) **or**
   v2 (with element validation), plus a size cap; v2 column default.
4. **Renderer → `LetterCanvas`**: textured paper, text layer, element layer, width-relative layout
   (section 6). `LetterRenderer` becomes a thin wrapper so the reading view, thread and tests keep working.
5. **Editor**: the compose screen becomes a desk workspace (Paper / Write / Decorate) with on-canvas
   selection and manipulation; the separate design-picker screen is folded into bottom trays.
6. **Assets**: 3 paper textures, 3 stamps, 3 stickers, 2 postmarks as bundled images; new fonts.
7. i18n names for every new catalog entry and editor control (en + ar, Arabic as `draft` in
   `ARABIC_REVIEW.md`).

Not changed: tables, RLS, RPCs, cron, Edge Functions, push, Realtime, SQLite schema.

## 4. Proposed structured data model (design v2)

```jsonc
{
  "v": 2,
  "paper": "aged_cream", // catalog key
  "font": "caveat", // catalog key (font/script rule unchanged)
  "ink": "sepia", // catalog key
  "textSize": "m", // "s" | "m" | "l"  (the brief's [Size])
  "layout": "standard", // kept, still the only value
  "elements": [
    {
      "id": "k3f9a2qx", // client-generated, [a-z0-9]{8}, unique within the letter
      "type": "stamp", // "stamp" | "sticker" | "postmark"
      "asset": "stamp_dove", // key in that type's catalog
      "x": 0.82,
      "y": 0.11, // element CENTRE, in canvas-width units, from the PHYSICAL left/top
      "scale": 1.0, // × the asset's catalog default width; 0.3..3
      "rotation": -8, // degrees, -180..180
      "z": 2, // integer stacking order among elements; normalized 0..n-1 on save
    },
  ],
}
```

Rules:

- **Coordinates are fractions of the canvas width** for both x and y (the paper's height grows with the
  text, so height cannot be the unit). `0 ≤ x ≤ 1`, `0 ≤ y ≤ MAX_Y` (catalog limit). Numbers are rounded
  to 4 decimals on save (small, deterministic JSON).
- **Physical, not logical, coordinates.** The composition must look identical to a sender in an LTR UI
  and a recipient in an RTL UI, so "left" means left. See section 7.
- **The text is not an element.** Subject and body stay structured text in `subject`/`body`/`body_dir`,
  laid out in a fixed flow with fixed margins. Elements are overlays above the text; `z` orders elements
  among themselves only. (Elements under the text, or movable text boxes, are later extensions that the
  `type` field already leaves room for.)
- **Postmarks with dates** take their date from the letter (`delivered_at`, or the scheduled/current date
  while a draft), formatted in the letter's language (`bodyDir` → `ar-u-ca-gregory-nu-latn` /
  `en-u-ca-gregory-nu-latn`), never stored as free text, so both sides render the same thing. City names
  and any user-typed postmark text are deferred (they would be new user content needing validation).
- **Forward compatibility.** An element whose `asset` this app version does not know is **skipped**, not a
  reason to throw away the whole design, so the asset library can grow without breaking older apps. A
  design whose `v` is newer than the app knows is **never overwritten** by autosave (fixes a latent v1
  issue: today an older JS bundle would normalize an unknown design to the default and could save that).
- Limits (provisional, named constants, OPEN-13): `maxElements` 24, scale 0.3–3, `MAX_Y` 40,
  `design` JSON ≤ 8 KB.

## 5. Database / storage implications

- **No new table, column, RLS policy, grant or RPC.** One forward-only migration (version above
  `20261001090000`):
  - `create or replace function is_valid_design(jsonb)`: `v = 1` → the existing literal rules, frozen;
    `v = 2` → keys, `textSize`, `elements` array length ≤ max, each element's `type`/`asset` against that
    type's key list, numeric ranges, integer `z`, `id` format, unique ids, and
    `octet_length(design::text) ≤ 8192`. Still `immutable`, still not revoked (CHECK helper).
  - Column default → the v2 default.
- **v1 must stay valid permanently**: CHECK constraints are re-evaluated on every UPDATE, including
  `mark_read`/delete-for-me on already-delivered v1 letters, and the immutability trigger forbids
  rewriting their `design`. No data migration of existing rows (it would be blocked anyway).
- **Assets are bundled in the APK** (`mobile/assets/designs/…`, WebP/PNG at @1x–@3x), not Supabase
  Storage (no buckets in MVP, DEC-011 spirit). Only keys travel over the wire. Budget: the first catalog
  should add well under 2 MB to the APK.
- Each new asset = catalog entry + SQL key list + i18n name, in one change (existing convention). If the
  library grows large, a later option is a catalog table read by `is_valid_design()`; not needed now.
- No flattened image anywhere: the server never renders or reconstructs anything.

## 6. Editor interaction approach

**Layout model: width-relative canvas.** Every measurement inside the canvas (margins, font size, line
height, element positions and sizes) is a fraction of the canvas width, and canvas text ignores the
system font scale. Line breaks then depend only on the bundled font and the text, not on the phone's
width, so sender and recipient get the same wrapping and the stamps sit over the same words. Paper
height = max(text height + margins, `1.414 × width` (A-paper ratio), lowest element's bottom). This
avoids a scale transform around a `TextInput` (Android cursor/selection bugs). Verified first in a spike.

**Workspace (one screen, replacing compose + pick-design):**

```
[ back ]   To: @name                [ Send ]
┌──────── letter canvas (scrolls) ────────┐
│  textured paper · subject · body        │
│  stamps / stickers / postmarks overlay  │
└──────────────────────────────────────────┘
 Paper | Write | Decorate           ← mode tabs
 tray for the mode:
   Paper:    3 paper swatches
   Write:    Font · Ink · Size
   Decorate: Stamps · Stickers · Postmarks → tap to add at the visible centre
 selected element bar: ⤒ forward ⤓ back · − + size · ↺ ↻ rotate · 🗑 delete
```

- **Modes avoid touch conflicts.** Write mode: the text is editable, elements ignore touches. Decorate
  mode: text is read-only, elements are interactive.
- **Gestures** (gesture-handler + Reanimated, already in the build): tap selects; pan drags; pinch
  scales; two-finger rotation rotates; all three run simultaneously on the selected element, on the UI
  thread. The canvas scrolls with a gesture-handler `ScrollView`; dragging an element blocks scrolling.
  State is committed to React (and autosave) **only on gesture end**, so a drag is one save, not 60.
- **Accessible equivalents for every gesture**: the selection bar buttons, ≥ 48 dp
  (`MIN_TOUCH_TARGET`), and each element exposes `accessibilityActions` (move, bigger/smaller, rotate,
  bring forward, delete) with a localized label ("Dove stamp"). Maestro uses the same buttons, because
  pinch/rotate cannot be scripted reliably.
- Elements are clamped so at least part of them stays on the paper; z is renormalized after each change.
- Undo is not in the first stage, except that delete shows a short "Undo" snackbar.

## 7. Arabic / RTL implications

- **Canvas coordinates are physical.** The canvas container sets `direction: 'ltr'` so absolute
  positioning inside it is stable in both UI directions (and stays within the "logical styles only" lint
  rule: `start` means left inside the canvas). This is the one documented exception: a letter is a physical
  object. The text inside still follows the **letter's** `bodyDir`, not the UI's (DEC-014 unchanged).
- New elements' default positions follow the letter's direction (a stamp lands in the reading-start
  corner of an Arabic letter), but once placed they are stored physically and never mirror.
- Typography gets equal weight: Arabic categories **calligraphic** (Aref Ruqaa, new), **traditional /
  formal naskh** (Amiri, existing; optionally Scheherazade New), **modern** (Cairo, Tajawal); Latin
  **handwriting** (Caveat), **traditional serif** (Playfair Display; IM Fell English as a candidate),
  **formal**. Each font gets a `category` and stays under the `scripts` rule. Tall Arabic faces need
  per-font line-height tuning (extend `OPTICAL_SCALE`) or ascenders/descenders clip. All OFL; licenses
  recorded.
- Postmark dates use explicit `-u-ca-gregory-nu-latn` locales; tray, element and accessibility names in
  both languages; every new Arabic string is `draft` in `ARABIC_REVIEW.md`.
- Pinch/rotate direction is physical in both UIs; selection-bar icons that imply direction use
  `<DirectionalIcon>`; "bring forward/back" icons are not directional.
- Verify every step in EN/LTR and AR/RTL, with Arabic letters written from an English UI and vice versa.

## 8. Offline draft implications

- No SQLite migration: `local_drafts.design` already stores any JSON. A v1 draft is upgraded on load
  (`normalizeDesign` → `upgradeDesignV1`) and saved as v2 on its next autosave.
- Autosave only on gesture end / discrete taps, through the existing debounce; last-write-wins per whole
  draft is fine for a single author.
- Element ids are generated on the device (works offline); assets are bundled, so decorating works fully
  offline.
- A server rejection of an invalid design (should not happen; the client validates with the same rules)
  surfaces through the existing sync error path, not data loss: the local draft stays.

## 9. Send / receive implications

- `send_letter`, delivery, cron, Realtime and push need **no change**; they carry `design` opaquely and the
  CHECK runs on every write.
- The reading view, thread and any preview switch to `LetterCanvas` read-only at the device's width. The
  same width-relative layout means the same composition on both phones.
- Recipient on an older app: unknown assets are skipped (section 4); an unknown `v` falls back to the
  default paper but still shows the text (as today).
- Push and notification text are unaffected (no letter content in payloads).

## 10. Testing requirements

- **Domain (Jest):** v2 schema accept/reject; limits; `upgradeDesignV1` for every v1 key; id format and
  uniqueness; z normalization; clamping; unknown-asset skipping; unknown-version preservation; JSON size.
- **pgTAP (new file + `letters.test.sql`):** v1 still valid; v2 valid default; each invalid case (bad key,
  type/asset mismatch, out-of-range x/y/scale/rotation, non-integer z, duplicate id, too many elements,
  oversize JSON) raises; `mark_read`/delete-for-me still work on a delivered **v1** letter; a delivered v2
  design cannot change.
- **Renderer (RNTL):** element positions/sizes/rotation computed from the model at two canvas widths give
  the same normalized geometry; physical positions identical under `I18nManager` RTL; text direction from
  `bodyDir`.
- **Editor (RNTL):** add/select/delete, selection-bar resize/rotate/layer, accessibility actions, mode
  switching, autosave once per gesture end (gesture-handler's Jest utilities for pan/pinch).
- **Maestro:** extend the compose flow: add stamp, sticker, postmark → move (swipe) → resize/rotate
  (buttons) → back → reopen draft → same composition.
- **Two-device manual (the critical test):** emulator + the owner's HONOR, EN/LTR and AR/RTL, place →
  move → resize → rotate → save → send → receive → reopen, offline decorate then sync, screenshots
  compared. Plus TalkBack on the editor, low-memory phone performance with 24 elements, long letters.

## 11. New phase vs existing phases

- **New Phase 12 — Vintage letter editor.** It replaces Phase 4's renderer and picker UI but Phase 4 stays
  closed (its catalog/validation mechanism is reused, not reopened). Order:
  Phase 10 baseline (done) → **Phase 12** → naming freeze / production-ID migration → Phase 10 release
  steps (store listing, EAS production, Play tracks), with Phase 10's accessibility/performance checks
  re-run on the new screens.
- **Phase 11 (iOS) is OUT OF SCOPE** (DEC-055) and is not renumbered or reused.
- Suggested Phase 12 steps, each ending with a stop to show the owner:
  - **12.0 Spike** (throwaway branch): gesture-handler/Reanimated as direct deps at the linked versions
    (no native rebuild expected; confirm), width-relative wrapping identical at two widths in Arabic and
    English, `TextInput` on a textured paper, simultaneous pan/pinch/rotate smoothness on the HONOR.
    Go/no-go for section 6.
  - **12.1 Domain**: catalog v2, schema v2, upgrade, limits, tests.
  - **12.2 Database**: `is_valid_design` v1|v2 migration + pgTAP → Database workflow → `db push`.
  - **12.3 Assets & fonts**: 3 papers, 3 stamps, 3 stickers, 2 postmarks, inks, new fonts, licenses.
  - **12.4 `LetterCanvas`** read-only, used by reading view and thread.
  - **12.5 Editor workspace** (modes, trays, gestures, selection bar, accessibility).
  - **12.6 End-to-end**: Maestro + two-device test + TalkBack; DECISIONS/ARABIC_REVIEW/CLAUDE.md updated.

## 12. Risks and compatibility issues

1. **Accessibility vs. fidelity (needs an owner decision, OPEN-13).** A composition that is identical on
   both phones cannot also reflow with the system font scale (DEC-056/059 made letters follow it).
   Proposal: canvas text ignores font scale; the letter's own Size (S/M/L), pinch-to-zoom in the reading
   view, and a "Read as plain text" toggle that does follow the font scale and the screen reader.
2. **Wrapping determinism** across phones is likely but unproven (bundled fonts, sub-pixel rounding).
   The spike measures it; fallback is a fixed logical width with a uniform scale transform for read-only
   rendering.
3. **Asset quality and licensing.** Authentic vintage art is the whole look; Claude can produce
   procedural paper textures and simple placeholder vector art, not finished illustration. Needs an owner
   source (commissioned or clearly CC0/OFL-licensed sets) before release; placeholders are fine for 12.0–12.5.
4. **Gesture/scroll conflicts and performance** on a 7 GB dev machine and mid-range phones: UI-thread
   gestures, commit-on-end, element cap, bundled WebP.
5. **Old JS clobbering newer designs** (section 4); harmless pre-release, fixed by the preservation rule.
6. **SQL catalog mirror** grows with every asset; acceptable for this stage, revisit when the library grows.
7. **gesture-handler 3 / Reanimated 4 APIs** differ from much online material; pin to the linked
   versions and follow their docs.
8. **Scope creep**: rich text, multiple text boxes, user images, image export and envelope animation are
   not in this stage (PLAN §7 OUT keeps images/attachments out).
