/**
 * Letter design (PLAN §3.4). Reads `shared/design-catalog.json`, the single source of truth also
 * used, as its own copy, by the database (`supabase/migrations/..._letters_design.sql`) - both must
 * change together, the same convention already used for the username reserved-word list
 * (DEC-010). Pure TypeScript: no React, no Supabase.
 */
import { z } from 'zod';

import catalog from '../../../shared/design-catalog.json';

export type Script = 'latin' | 'arabic';

export interface PaperEntry {
  key: string;
  color: string;
}
export interface FontEntry {
  key: string;
  family: string;
  scripts: readonly Script[];
}
export interface InkEntry {
  key: string;
  color: string;
}
export interface StampEntry {
  key: string;
  icon: string;
}

export interface DesignCatalog {
  version: number;
  papers: readonly PaperEntry[];
  fonts: readonly FontEntry[];
  inks: readonly InkEntry[];
  stamps: readonly StampEntry[];
  /** One fallback font per script, used when a design's chosen font does not support the letter's
   *  actual script (PLAN §3.4's "renderer falls back... font/script rule"). PLAN describes this as
   *  "the paper's paired Arabic font" (a per-paper pairing); simplified here to one fallback per
   *  script for the whole catalog, since a considered per-paper pairing is a design-content
   *  decision this change does not make - see DECISIONS.md. */
  fallbackFonts: Readonly<Record<Script, string>>;
  defaults: { paper: string; font: string; ink: string; stamp: string | null };
}

// The JSON's `scripts` fields are inferred as `string[]`, not the narrower `Script[]`; the cast is
// the only way to assert that, not an escape from real validation (design values *are* validated,
// by designSchema below - this only concerns the catalog's own shape, which is checked by
// design.test.ts's "matches PLAN §7's counts" style assertions instead).
export const DESIGN_CATALOG = catalog as DesignCatalog;

function keyTuple<T extends { key: string }>(entries: readonly T[]): [string, ...string[]] {
  const keys = entries.map((e) => e.key);
  if (keys.length === 0) throw new Error('design catalog: an entry list is empty');
  return keys as [string, ...string[]];
}

/**
 * The stored/synced shape (PLAN §3.4): `{ v, paper, font, ink, layout, stamp, stickers[] }`.
 * `layout` and `stickers` are reserved for a later phase: exactly `'standard'` / `[]` for now, so
 * the shape matches PLAN without this phase building a layout or sticker picker.
 */
export const designSchema = z.object({
  v: z.literal(DESIGN_CATALOG.version),
  paper: z.enum(keyTuple(DESIGN_CATALOG.papers)),
  font: z.enum(keyTuple(DESIGN_CATALOG.fonts)),
  ink: z.enum(keyTuple(DESIGN_CATALOG.inks)),
  layout: z.literal('standard'),
  stamp: z.enum(keyTuple(DESIGN_CATALOG.stamps)).nullable(),
  stickers: z.tuple([]),
});

export type Design = z.infer<typeof designSchema>;

export function defaultDesign(): Design {
  return {
    v: DESIGN_CATALOG.version,
    paper: DESIGN_CATALOG.defaults.paper,
    font: DESIGN_CATALOG.defaults.font,
    ink: DESIGN_CATALOG.defaults.ink,
    layout: 'standard',
    stamp: DESIGN_CATALOG.defaults.stamp,
    stickers: [],
  };
}

/**
 * Never throws: an invalid, unrecognized-version, or malformed design becomes the default rather
 * than a crash or partially-trusted input (PLAN §3.4: "unknown key/version... -> fallback design").
 */
export function normalizeDesign(value: unknown): Design {
  const result = designSchema.safeParse(value);
  return result.success ? result.data : defaultDesign();
}

export function paperOf(design: Design): PaperEntry {
  return DESIGN_CATALOG.papers.find((p) => p.key === design.paper) ?? DESIGN_CATALOG.papers[0];
}

export function inkOf(design: Design): InkEntry {
  return DESIGN_CATALOG.inks.find((i) => i.key === design.ink) ?? DESIGN_CATALOG.inks[0];
}

export function stampOf(design: Design): StampEntry | null {
  return DESIGN_CATALOG.stamps.find((s) => s.key === design.stamp) ?? null;
}

function scriptFor(bodyDir: 'ltr' | 'rtl'): Script {
  return bodyDir === 'rtl' ? 'arabic' : 'latin';
}

/** Fonts the composer may offer for a letter of this direction (PLAN §3.4 font/script rule). */
export function fontsForDirection(bodyDir: 'ltr' | 'rtl'): readonly FontEntry[] {
  const script = scriptFor(bodyDir);
  return DESIGN_CATALOG.fonts.filter((f) => f.scripts.includes(script));
}

/** The font the renderer actually uses: the design's chosen font if it supports the body's
 *  script, else the catalog's fallback for that script. */
export function resolveFont(design: Design, bodyDir: 'ltr' | 'rtl'): FontEntry {
  const script = scriptFor(bodyDir);
  const chosen = DESIGN_CATALOG.fonts.find((f) => f.key === design.font);
  if (chosen && chosen.scripts.includes(script)) return chosen;
  const fallbackKey = DESIGN_CATALOG.fallbackFonts[script];
  return DESIGN_CATALOG.fonts.find((f) => f.key === fallbackKey) ?? DESIGN_CATALOG.fonts[0];
}
