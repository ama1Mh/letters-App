/**
 * Letter design v2 (DEC-060/061/062). Reads `shared/design-catalog.json`, the single source of truth
 * that `public.is_valid_design()` mirrors in SQL; both must change together (same convention as the
 * username reserved-word list, DEC-010). Pure TypeScript: no React, no Supabase.
 *
 * A design is structured data, never an image: paper, font, ink, text size and a list of placed
 * elements (stamps, stickers, postmarks). Element positions are fractions of the canvas width,
 * measured from the PHYSICAL top-left, so a composition looks the same in an LTR and an RTL UI.
 */
import { z } from 'zod';

import catalog from '../../../shared/design-catalog.json';

export type Script = 'latin' | 'arabic';
export type FontCategory = 'handwriting' | 'traditional' | 'formal' | 'calligraphic' | 'modern';
export type ElementType = 'stamp' | 'sticker' | 'postmark';
export type TextSize = 's' | 'm' | 'l';

export const ELEMENT_TYPES: readonly ElementType[] = ['stamp', 'sticker', 'postmark'];

export interface PaperEntry {
  key: string;
  color: string;
}
export interface FontEntry {
  key: string;
  family: string;
  scripts: readonly Script[];
  category: FontCategory;
}
export interface InkEntry {
  key: string;
  color: string;
}
export interface TextSizeEntry {
  key: TextSize;
  /** Body size in dp at the 360 dp logical canvas width. */
  size: number;
}
export interface ElementEntry {
  key: string;
  /** Width at scale 1, as a fraction of the canvas width. */
  width: number;
  /** Height / width of the artwork. */
  aspect: number;
  /** Postmarks only: the renderer writes the letter's date across it. */
  dated?: boolean;
}

export interface DesignCatalog {
  version: number;
  papers: readonly PaperEntry[];
  fonts: readonly FontEntry[];
  inks: readonly InkEntry[];
  textSizes: readonly TextSizeEntry[];
  elements: Readonly<Record<ElementType, readonly ElementEntry[]>>;
  limits: {
    maxElements: number;
    minScale: number;
    maxScale: number;
    maxY: number;
    maxDesignBytes: number;
  };
  /** One fallback font per script, used when the chosen font lacks the letter's script. */
  fallbackFonts: Readonly<Record<Script, string>>;
  defaults: { paper: string; font: string; ink: string; textSize: TextSize };
}

// The JSON's string fields are inferred as `string`, not the narrower unions; the cast only
// asserts the catalog's own shape, which design.test.ts checks entry by entry.
export const DESIGN_CATALOG = catalog as DesignCatalog;
export const DESIGN_LIMITS = DESIGN_CATALOG.limits;
export const DESIGN_VERSION = 2;

function keyTuple<T extends { key: string }>(entries: readonly T[]): [string, ...string[]] {
  const keys = entries.map((e) => e.key);
  if (keys.length === 0) throw new Error('design catalog: an entry list is empty');
  return keys as [string, ...string[]];
}

export const ELEMENT_ID_PATTERN = /^[a-z0-9]{8}$/;

export const elementSchema = z
  .object({
    id: z.string().regex(ELEMENT_ID_PATTERN),
    type: z.enum(['stamp', 'sticker', 'postmark']),
    asset: z.string(),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(DESIGN_LIMITS.maxY),
    scale: z.number().min(DESIGN_LIMITS.minScale).max(DESIGN_LIMITS.maxScale),
    rotation: z.number().min(-180).max(180),
    z: z
      .number()
      .int()
      .min(0)
      .max(DESIGN_LIMITS.maxElements - 1),
  })
  .strict();

export type DesignElement = z.infer<typeof elementSchema>;

export function elementEntry(type: ElementType, asset: string): ElementEntry | null {
  return DESIGN_CATALOG.elements[type].find((e) => e.key === asset) ?? null;
}

/**
 * The stored/synced shape. Mirrors `is_valid_design()` (v2 branch): exact keys, catalog keys,
 * element shape and ranges, asset belongs to its type, unique ids, at most `maxElements`, and the
 * serialized size limit. The server re-checks all of it; this keeps invalid data from being saved.
 */
export const designSchema = z
  .object({
    v: z.literal(DESIGN_VERSION),
    paper: z.enum(keyTuple(DESIGN_CATALOG.papers)),
    font: z.enum(keyTuple(DESIGN_CATALOG.fonts)),
    ink: z.enum(keyTuple(DESIGN_CATALOG.inks)),
    textSize: z.enum(['s', 'm', 'l']),
    layout: z.literal('standard'),
    elements: z.array(elementSchema).max(DESIGN_LIMITS.maxElements),
  })
  .strict()
  .superRefine((design, ctx) => {
    const ids = new Set<string>();
    design.elements.forEach((el, i) => {
      if (!elementEntry(el.type, el.asset)) {
        ctx.addIssue({ code: 'custom', message: 'unknown_asset', path: ['elements', i, 'asset'] });
      }
      if (ids.has(el.id)) {
        ctx.addIssue({ code: 'custom', message: 'duplicate_id', path: ['elements', i, 'id'] });
      }
      ids.add(el.id);
    });
    if (designByteSize(design) > DESIGN_LIMITS.maxDesignBytes) {
      ctx.addIssue({ code: 'custom', message: 'too_large' });
    }
  });

export type Design = z.infer<typeof designSchema>;

export function defaultDesign(): Design {
  const { defaults } = DESIGN_CATALOG;
  return {
    v: DESIGN_VERSION,
    paper: defaults.paper,
    font: defaults.font,
    ink: defaults.ink,
    textSize: defaults.textSize,
    layout: 'standard',
    elements: [],
  };
}

/**
 * Upper estimate of the design's size as Postgres measures it (`octet_length(design::text)`):
 * jsonb's text form adds a space after every `:` and `,`. Every string in a valid design is a
 * catalog key, an id or a fixed word, none containing `:` or `,`, so counting them is exact enough.
 */
export function designByteSize(design: unknown): number {
  const json = JSON.stringify(design) ?? '';
  let bytes = 0;
  for (const ch of json) {
    const code = ch.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    if (ch === ':' || ch === ',') bytes += 1;
  }
  return bytes;
}

// ---------------------------------------------------------------------------------------------
// v1 (Phase 4) designs: still stored on existing letters (delivered ones can never change), so the
// app upgrades them on read. The key lists are frozen copies of the v1 catalog and must match the
// v1 branch of is_valid_design().
// ---------------------------------------------------------------------------------------------

const v1Schema = z.object({
  v: z.literal(1),
  paper: z.enum(['cream', 'blush', 'sky', 'mint', 'sand', 'lavender']),
  font: z.enum(['caveat', 'playfair_display', 'cairo', 'tajawal', 'amiri']),
  ink: z.enum([
    'classic_black',
    'navy',
    'forest',
    'burgundy',
    'charcoal',
    'royal_purple',
    'warm_brown',
    'teal',
  ]),
  layout: z.literal('standard'),
  stamp: z.enum(['heart', 'star', 'ribbon', 'rocket']).nullable(),
  stickers: z.tuple([]),
});

const V1_PAPER: Record<string, string> = {
  cream: 'aged_cream',
  sand: 'parchment',
  blush: 'warm_ivory',
  sky: 'warm_ivory',
  mint: 'warm_ivory',
  lavender: 'warm_ivory',
};
const V1_INK: Record<string, string> = {
  classic_black: 'black',
  charcoal: 'black',
  navy: 'faded_blue',
  royal_purple: 'faded_blue',
  forest: 'forest_green',
  teal: 'forest_green',
  burgundy: 'burgundy',
  warm_brown: 'dark_brown',
};
const V1_STAMP: Record<string, string> = {
  heart: 'stamp_dove',
  star: 'stamp_lighthouse',
  ribbon: 'stamp_palm',
  rocket: 'stamp_lighthouse',
};

/** Deterministic, so both sides of a conversation upgrade a v1 letter identically. */
export function upgradeDesignV1(value: unknown): Design | null {
  const parsed = v1Schema.safeParse(value);
  if (!parsed.success) return null;
  const v1 = parsed.data;
  const design: Design = {
    ...defaultDesign(),
    paper: V1_PAPER[v1.paper],
    font: v1.font, // every v1 font is still in the catalog
    ink: V1_INK[v1.ink],
  };
  if (v1.stamp) {
    design.elements = [
      {
        id: 'v1stamp0',
        type: 'stamp',
        asset: V1_STAMP[v1.stamp],
        x: 0.84,
        y: 0.14,
        scale: 1,
        rotation: 0,
        z: 0,
      },
    ];
  }
  return design;
}

// ---------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------

export interface ReadDesign {
  design: Design;
  /**
   * False when the stored value holds something this app version cannot represent (a newer
   * version, or keys from a newer catalog). The editor must then not save its own `design` over
   * the stored one, or the newer data would be lost (DEC-060 (4)).
   */
  editable: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickKey(entries: readonly { key: string }[], value: unknown): string | null {
  return typeof value === 'string' && entries.some((e) => e.key === value) ? value : null;
}

/**
 * Never throws. Valid v2 is returned as is; v1 is upgraded; a v2 design with unknown keys keeps
 * what this app understands (unknown elements are skipped, unknown paper/font/ink fall back) and is
 * marked read-only; anything else becomes the default.
 */
export function readDesign(value: unknown): ReadDesign {
  const strict = designSchema.safeParse(value);
  if (strict.success) return { design: strict.data, editable: true };

  const v1 = upgradeDesignV1(value);
  if (v1) return { design: v1, editable: true };

  if (!isRecord(value) || typeof value.v !== 'number') {
    return { design: defaultDesign(), editable: true };
  }
  if (value.v !== DESIGN_VERSION) {
    // A newer version (or a corrupt number): show the default, never overwrite it.
    return { design: defaultDesign(), editable: value.v < DESIGN_VERSION };
  }

  const base = defaultDesign();
  const paper = pickKey(DESIGN_CATALOG.papers, value.paper);
  const font = pickKey(DESIGN_CATALOG.fonts, value.font);
  const ink = pickKey(DESIGN_CATALOG.inks, value.ink);
  const textSize = (['s', 'm', 'l'] as const).find((s) => s === value.textSize) ?? null;
  const rawElements = Array.isArray(value.elements) ? value.elements : [];
  const elements: DesignElement[] = [];
  const ids = new Set<string>();
  for (const raw of rawElements) {
    const el = elementSchema.safeParse(raw);
    if (!el.success || !elementEntry(el.data.type, el.data.asset) || ids.has(el.data.id)) continue;
    if (elements.length >= DESIGN_LIMITS.maxElements) break;
    ids.add(el.data.id);
    elements.push(el.data);
  }
  return {
    design: {
      ...base,
      paper: paper ?? base.paper,
      font: font ?? base.font,
      ink: ink ?? base.ink,
      textSize: textSize ?? base.textSize,
      elements: normalizeZ(elements),
    },
    editable: false,
  };
}

/** Shorthand for callers that only display a design. */
export function normalizeDesign(value: unknown): Design {
  return readDesign(value).design;
}

// ---------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------

export function paperOf(design: Design): PaperEntry {
  return DESIGN_CATALOG.papers.find((p) => p.key === design.paper) ?? DESIGN_CATALOG.papers[0];
}

export function inkOf(design: Design): InkEntry {
  return DESIGN_CATALOG.inks.find((i) => i.key === design.ink) ?? DESIGN_CATALOG.inks[0];
}

export function textSizeOf(design: Design): number {
  const entry = DESIGN_CATALOG.textSizes.find((s) => s.key === design.textSize);
  return (entry ?? DESIGN_CATALOG.textSizes[1]).size;
}

function scriptFor(bodyDir: 'ltr' | 'rtl'): Script {
  return bodyDir === 'rtl' ? 'arabic' : 'latin';
}

/** Fonts the composer may offer for a letter of this direction (PLAN §3.4 font/script rule). */
export function fontsForDirection(bodyDir: 'ltr' | 'rtl'): readonly FontEntry[] {
  const script = scriptFor(bodyDir);
  return DESIGN_CATALOG.fonts.filter((f) => f.scripts.includes(script));
}

/** The font the renderer actually uses: the chosen font if it supports the body's script, else
 *  the catalog's fallback for that script. */
export function resolveFont(design: Design, bodyDir: 'ltr' | 'rtl'): FontEntry {
  const script = scriptFor(bodyDir);
  const chosen = DESIGN_CATALOG.fonts.find((f) => f.key === design.font);
  if (chosen && chosen.scripts.includes(script)) return chosen;
  const fallbackKey = DESIGN_CATALOG.fallbackFonts[script];
  return DESIGN_CATALOG.fonts.find((f) => f.key === fallbackKey) ?? DESIGN_CATALOG.fonts[0];
}

// ---------------------------------------------------------------------------------------------
// Editing (pure; every function returns a new design)
// ---------------------------------------------------------------------------------------------

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** `random` returns [0, 1), injectable for tests. */
export function newElementId(random: () => number, taken: ReadonlySet<string> = new Set()): string {
  for (;;) {
    let id = '';
    for (let i = 0; i < 8; i += 1) id += ID_ALPHABET[Math.floor(random() * ID_ALPHABET.length)];
    if (!taken.has(id)) return id;
  }
}

function round(value: number, places: number): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

/** Wraps any angle into [-180, 180]. */
export function normalizeRotation(degrees: number): number {
  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 && degrees > 0 ? 180 : wrapped;
}

/** Clamps position and scale into the valid ranges and rounds to the stored precision. */
export function clampElement(el: DesignElement): DesignElement {
  const { minScale, maxScale, maxY } = DESIGN_LIMITS;
  return {
    ...el,
    x: round(Math.min(1, Math.max(0, el.x)), 4),
    y: round(Math.min(maxY, Math.max(0, el.y)), 4),
    scale: round(Math.min(maxScale, Math.max(minScale, el.scale)), 4),
    rotation: round(normalizeRotation(el.rotation), 2),
  };
}

/** Renumbers `z` to 0..n-1, keeping the current stacking order (ties keep list order). */
export function normalizeZ(elements: readonly DesignElement[]): DesignElement[] {
  const order = elements
    .map((el, index) => ({ el, index }))
    .sort((a, b) => a.el.z - b.el.z || a.index - b.index);
  const rank = new Map(order.map((o, i) => [o.el.id, i]));
  return elements.map((el) => ({ ...el, z: rank.get(el.id) ?? 0 }));
}

/** Elements in paint order (lowest first). */
export function paintOrder(elements: readonly DesignElement[]): DesignElement[] {
  return [...elements].sort((a, b) => a.z - b.z);
}

export function canAddElement(design: Design): boolean {
  return design.elements.length < DESIGN_LIMITS.maxElements;
}

export interface AddElementOptions {
  /** Letter direction: a stamp's default spot is the letter's reading-start top corner. */
  bodyDir: 'ltr' | 'rtl';
  /** Vertical centre of the visible part of the canvas, in canvas-width units. */
  visibleCenterY: number;
  random: () => number;
}

/** Adds an element on top of the others; returns null at the element limit or for an unknown asset. */
export function addElement(
  design: Design,
  type: ElementType,
  asset: string,
  options: AddElementOptions,
): { design: Design; id: string } | null {
  if (!canAddElement(design) || !elementEntry(type, asset)) return null;
  const id = newElementId(options.random, new Set(design.elements.map((e) => e.id)));
  // Stamps start in the top corner where a stamp belongs (the letter's end side: top-right for
  // English, top-left for Arabic); everything else starts in the middle of what is on screen.
  const isStamp = type === 'stamp';
  const x = isStamp ? (options.bodyDir === 'rtl' ? 0.16 : 0.84) : 0.5;
  const y = isStamp ? 0.16 : options.visibleCenterY;
  const el = clampElement({
    id,
    type,
    asset,
    x,
    y,
    scale: 1,
    rotation: 0,
    z: design.elements.length,
  });
  return { design: { ...design, elements: normalizeZ([...design.elements, el]) }, id };
}

export function updateElement(
  design: Design,
  id: string,
  patch: Partial<Pick<DesignElement, 'x' | 'y' | 'scale' | 'rotation'>>,
): Design {
  return {
    ...design,
    elements: design.elements.map((el) => (el.id === id ? clampElement({ ...el, ...patch }) : el)),
  };
}

export function removeElement(design: Design, id: string): Design {
  return { ...design, elements: normalizeZ(design.elements.filter((el) => el.id !== id)) };
}

/** Moves an element one step up (+1) or down (-1) the stack. */
export function shiftLayer(design: Design, id: string, step: 1 | -1): Design {
  const ordered = paintOrder(normalizeZ(design.elements));
  const from = ordered.findIndex((el) => el.id === id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= ordered.length) return design;
  [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
  const z = new Map(ordered.map((el, i) => [el.id, i]));
  return { ...design, elements: design.elements.map((el) => ({ ...el, z: z.get(el.id) ?? el.z })) };
}
