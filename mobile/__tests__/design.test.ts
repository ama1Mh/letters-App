import {
  DESIGN_CATALOG,
  DESIGN_LIMITS,
  ELEMENT_TYPES,
  addElement,
  clampElement,
  defaultDesign,
  designByteSize,
  designSchema,
  fontsForDirection,
  inkOf,
  newElementId,
  normalizeDesign,
  normalizeRotation,
  normalizeZ,
  paintOrder,
  paperOf,
  readDesign,
  removeElement,
  resolveFont,
  shiftLayer,
  textSizeOf,
  updateElement,
  upgradeDesignV1,
  type Design,
  type DesignElement,
} from '@/domain/design';

function seq(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

function el(overrides: Partial<DesignElement> = {}): DesignElement {
  return {
    id: 'abcd1234',
    type: 'stamp',
    asset: 'stamp_dove',
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
    z: 0,
    ...overrides,
  };
}

function withElements(elements: DesignElement[]): Design {
  return { ...defaultDesign(), elements };
}

describe('design catalog (DEC-060/061 first stage)', () => {
  it('has the first-stage counts: 3 papers, 6 inks, 3 stamps, 3 stickers, 2 postmarks', () => {
    expect(DESIGN_CATALOG.version).toBe(2);
    expect(DESIGN_CATALOG.papers).toHaveLength(3);
    expect(DESIGN_CATALOG.inks).toHaveLength(6);
    expect(DESIGN_CATALOG.elements.stamp).toHaveLength(3);
    expect(DESIGN_CATALOG.elements.sticker).toHaveLength(3);
    expect(DESIGN_CATALOG.elements.postmark).toHaveLength(2);
    expect(DESIGN_CATALOG.textSizes.map((s) => s.key)).toEqual(['s', 'm', 'l']);
  });

  it('has the owner-approved limits (DEC-061 (3))', () => {
    expect(DESIGN_LIMITS).toEqual({
      maxElements: 24,
      minScale: 0.3,
      maxScale: 3,
      maxY: 40,
      maxDesignBytes: 8192,
    });
  });

  it('gives Arabic and Latin the same font categories (equal attention, DEC-060)', () => {
    const categories = (script: 'latin' | 'arabic') =>
      new Set(
        DESIGN_CATALOG.fonts.filter((f) => f.scripts.includes(script)).map((f) => f.category),
      );
    for (const category of ['handwriting', 'traditional', 'modern'] as const) {
      expect(categories('arabic').has(category)).toBe(true);
      expect(categories('latin').has(category)).toBe(true);
    }
    expect(categories('arabic').has('calligraphic')).toBe(true);
  });

  it('every key is unique, every default and fallback exists, every element entry is sane', () => {
    const lists = [
      DESIGN_CATALOG.papers,
      DESIGN_CATALOG.fonts,
      DESIGN_CATALOG.inks,
      ...ELEMENT_TYPES.map((t) => DESIGN_CATALOG.elements[t]),
    ];
    const all = lists.flatMap((l) => l.map((e) => e.key));
    expect(new Set(all).size).toBe(all.length);
    const { defaults } = DESIGN_CATALOG;
    expect(DESIGN_CATALOG.papers.some((p) => p.key === defaults.paper)).toBe(true);
    expect(DESIGN_CATALOG.fonts.some((f) => f.key === defaults.font)).toBe(true);
    expect(DESIGN_CATALOG.inks.some((i) => i.key === defaults.ink)).toBe(true);
    for (const key of Object.values(DESIGN_CATALOG.fallbackFonts)) {
      expect(DESIGN_CATALOG.fonts.some((f) => f.key === key)).toBe(true);
    }
    for (const type of ELEMENT_TYPES) {
      for (const entry of DESIGN_CATALOG.elements[type]) {
        expect(entry.key.startsWith(`${type}_`)).toBe(true);
        expect(entry.width).toBeGreaterThan(0);
        expect(entry.width).toBeLessThanOrEqual(1);
        expect(entry.aspect).toBeGreaterThan(0);
      }
    }
  });
});

describe('designSchema (mirrors is_valid_design v2)', () => {
  it('accepts the default and a realistic composition', () => {
    expect(designSchema.safeParse(defaultDesign()).success).toBe(true);
    const design = withElements([
      el({ id: 'aaaaaaa1', z: 0 }),
      el({ id: 'aaaaaaa2', type: 'sticker', asset: 'sticker_moon', y: 1.3, rotation: 12.5, z: 1 }),
      el({ id: 'aaaaaaa3', type: 'postmark', asset: 'postmark_round', scale: 0.3, z: 2 }),
    ]);
    expect(designSchema.safeParse(design).success).toBe(true);
  });

  it.each<[string, unknown]>([
    ['unknown paper', { ...defaultDesign(), paper: 'gold_foil' }],
    ['v1 shape', { ...defaultDesign(), v: 1 }],
    ['extra key', { ...defaultDesign(), stamp: null }],
    ['bad text size', { ...defaultDesign(), textSize: 'xl' }],
    ['scale above 3', withElements([el({ scale: 3.01 })])],
    ['scale below 0.3', withElements([el({ scale: 0.29 })])],
    ['x above 1', withElements([el({ x: 1.01 })])],
    ['y above 40', withElements([el({ y: 40.5 })])],
    ['rotation out of range', withElements([el({ rotation: 181 })])],
    ['fractional z', withElements([el({ z: 0.5 })])],
    ['string x', withElements([{ ...el(), x: '0.5' } as unknown as DesignElement])],
    ['bad id', withElements([el({ id: 'ABCD1234' })])],
    ['type/asset mismatch', withElements([el({ type: 'sticker', asset: 'stamp_dove' })])],
    ['duplicate ids', withElements([el({ z: 0 }), el({ z: 1 })])],
    ['extra element key', withElements([{ ...el(), color: 'red' } as unknown as DesignElement])],
    [
      'more than 24 elements',
      withElements(
        Array.from({ length: 25 }, (_, i) => el({ id: `id${String(i).padStart(6, '0')}`, z: 0 })),
      ),
    ],
  ])('rejects %s', (_name, value) => {
    expect(designSchema.safeParse(value).success).toBe(false);
  });

  it('keeps a maximal 24-element design well under 8 KB (as Postgres measures it)', () => {
    const design = withElements(
      Array.from({ length: 24 }, (_, i) =>
        el({
          id: `id${String(i).padStart(6, '0')}`,
          type: 'postmark',
          asset: 'postmark_round',
          x: 0.1234,
          y: 39.9999,
          scale: 2.9999,
          rotation: -179.99,
          z: i,
        }),
      ),
    );
    expect(designSchema.safeParse(design).success).toBe(true);
    // Measured on the linked Postgres in the 12.0 spike: 3,419 bytes for a comparable design.
    expect(designByteSize(design)).toBeLessThan(4000);
  });

  it('designByteSize counts jsonb spacing and multi-byte characters', () => {
    expect(designByteSize({ a: 1 })).toBe(JSON.stringify({ a: 1 }).length + 1); // ": "
    expect(designByteSize({ a: 'é' })).toBe(JSON.stringify({ a: 'x' }).length + 1 + 1);
  });
});

describe('upgradeDesignV1', () => {
  const v1 = {
    v: 1,
    paper: 'sky',
    font: 'amiri',
    ink: 'navy',
    layout: 'standard',
    stamp: null,
    stickers: [],
  };

  it('maps every v1 paper and ink to a v2 key and keeps the font', () => {
    for (const paper of ['cream', 'blush', 'sky', 'mint', 'sand', 'lavender']) {
      for (const ink of [
        'classic_black',
        'navy',
        'forest',
        'burgundy',
        'charcoal',
        'royal_purple',
        'warm_brown',
        'teal',
      ]) {
        const up = upgradeDesignV1({ ...v1, paper, ink });
        expect(up).not.toBeNull();
        expect(designSchema.safeParse(up).success).toBe(true);
        expect(up?.font).toBe('amiri');
      }
    }
  });

  it('turns a v1 stamp into a placed stamp element, deterministically', () => {
    for (const stamp of ['heart', 'star', 'ribbon', 'rocket']) {
      const a = upgradeDesignV1({ ...v1, stamp });
      const b = upgradeDesignV1({ ...v1, stamp });
      expect(a).toEqual(b);
      expect(a?.elements).toHaveLength(1);
      expect(a?.elements[0].type).toBe('stamp');
      expect(designSchema.safeParse(a).success).toBe(true);
    }
    expect(upgradeDesignV1(v1)?.elements).toEqual([]);
  });

  it('returns null for anything that is not a valid v1 design', () => {
    expect(upgradeDesignV1({ ...v1, paper: 'gold' })).toBeNull();
    expect(upgradeDesignV1(defaultDesign())).toBeNull();
    expect(upgradeDesignV1(null)).toBeNull();
  });
});

describe('readDesign / normalizeDesign', () => {
  it('returns a valid v2 design unchanged and editable', () => {
    const design = withElements([el()]);
    expect(readDesign(design)).toEqual({ design, editable: true });
  });

  it('upgrades a v1 design (editable)', () => {
    const read = readDesign({
      v: 1,
      paper: 'cream',
      font: 'caveat',
      ink: 'classic_black',
      layout: 'standard',
      stamp: 'heart',
      stickers: [],
    });
    expect(read.editable).toBe(true);
    expect(read.design.paper).toBe('aged_cream');
    expect(read.design.elements).toHaveLength(1);
  });

  it('falls back to the default for garbage, editable (nothing to preserve)', () => {
    for (const value of [null, undefined, 'x', 42, {}, [], { v: 'two' }]) {
      expect(readDesign(value)).toEqual({ design: defaultDesign(), editable: true });
    }
  });

  it('never lets the editor overwrite a newer design version', () => {
    expect(readDesign({ v: 3, paper: 'gold' })).toEqual({
      design: defaultDesign(),
      editable: false,
    });
  });

  it('keeps what it understands from a v2 design with newer catalog keys, read-only', () => {
    const read = readDesign({
      ...defaultDesign(),
      paper: 'future_paper',
      ink: 'sepia',
      elements: [
        el({ id: 'known001', z: 1 }),
        el({ id: 'future01', type: 'sticker', asset: 'sticker_future', z: 0 }),
      ],
    });
    expect(read.editable).toBe(false);
    expect(read.design.paper).toBe(DESIGN_CATALOG.defaults.paper);
    expect(read.design.ink).toBe('sepia');
    expect(read.design.elements.map((e) => e.id)).toEqual(['known001']);
    expect(read.design.elements[0].z).toBe(0);
  });

  it('normalizeDesign is the display shorthand', () => {
    expect(normalizeDesign(null)).toEqual(defaultDesign());
  });
});

describe('lookups', () => {
  it('paperOf / inkOf / textSizeOf', () => {
    const design = { ...defaultDesign(), paper: 'parchment', ink: 'sepia', textSize: 'l' as const };
    expect(paperOf(design).key).toBe('parchment');
    expect(inkOf(design).key).toBe('sepia');
    expect(textSizeOf(design)).toBe(22);
    expect(textSizeOf(defaultDesign())).toBe(18);
  });
});

describe('fontsForDirection / resolveFont (PLAN §3.4 font/script rule)', () => {
  it('offers only fonts that support the letter script', () => {
    expect(fontsForDirection('rtl').every((f) => f.scripts.includes('arabic'))).toBe(true);
    expect(fontsForDirection('ltr').every((f) => f.scripts.includes('latin'))).toBe(true);
    expect(fontsForDirection('rtl').map((f) => f.key)).toContain('aref_ruqaa');
  });

  it('falls back to the Arabic fallback for a Latin-only font on an Arabic letter', () => {
    const resolved = resolveFont({ ...defaultDesign(), font: 'im_fell_english' }, 'rtl');
    expect(resolved.key).toBe(DESIGN_CATALOG.fallbackFonts.arabic);
    expect(resolveFont({ ...defaultDesign(), font: 'aref_ruqaa' }, 'ltr').key).toBe('aref_ruqaa');
  });
});

describe('editing helpers', () => {
  it('newElementId: 8 chars of [a-z0-9], avoids taken ids', () => {
    const id = newElementId(seq(0.01, 0.5, 0.99));
    expect(id).toMatch(/^[a-z0-9]{8}$/);
    const first = newElementId(seq(0));
    expect(newElementId(seq(0, 0, 0, 0, 0, 0, 0, 0, 0.5), new Set([first]))).not.toBe(first);
  });

  it('normalizeRotation wraps into [-180, 180]', () => {
    expect(normalizeRotation(190)).toBe(-170);
    expect(normalizeRotation(-190)).toBe(170);
    expect(normalizeRotation(540)).toBe(180);
    expect(normalizeRotation(-45)).toBe(-45);
  });

  it('clampElement clamps and rounds into the stored ranges', () => {
    const c = clampElement(el({ x: 1.2, y: -3, scale: 9, rotation: 370.123456 }));
    expect(c).toMatchObject({ x: 1, y: 0, scale: 3, rotation: 10.12 });
    expect(clampElement(el({ x: 0.123456789 })).x).toBe(0.1235);
  });

  it('addElement places stamps in the letter-direction corner, others mid-view, on top', () => {
    const ltr = addElement(defaultDesign(), 'stamp', 'stamp_dove', {
      bodyDir: 'ltr',
      visibleCenterY: 2,
      random: seq(0.1),
    });
    expect(ltr?.design.elements[0]).toMatchObject({ x: 0.84, y: 0.16 });
    const rtl = addElement(defaultDesign(), 'stamp', 'stamp_dove', {
      bodyDir: 'rtl',
      visibleCenterY: 2,
      random: seq(0.1),
    });
    expect(rtl?.design.elements[0].x).toBe(0.16);
    const sticker = addElement(ltr!.design, 'sticker', 'sticker_flower', {
      bodyDir: 'ltr',
      visibleCenterY: 2,
      random: seq(0.7),
    });
    expect(sticker?.design.elements[1]).toMatchObject({ x: 0.5, y: 2, z: 1 });
    expect(designSchema.safeParse(sticker?.design).success).toBe(true);
  });

  it('addElement refuses unknown assets and the 25th element', () => {
    const opts = { bodyDir: 'ltr' as const, visibleCenterY: 1, random: Math.random };
    expect(addElement(defaultDesign(), 'stamp', 'sticker_moon', opts)).toBeNull();
    let design = defaultDesign();
    for (let i = 0; i < 24; i += 1)
      design = addElement(design, 'sticker', 'sticker_moon', opts)!.design;
    expect(designSchema.safeParse(design).success).toBe(true);
    expect(addElement(design, 'sticker', 'sticker_moon', opts)).toBeNull();
  });

  it('updateElement clamps; removeElement renumbers z', () => {
    const design = withElements([el({ id: 'aaaaaaa1', z: 0 }), el({ id: 'aaaaaaa2', z: 1 })]);
    expect(updateElement(design, 'aaaaaaa2', { scale: 10 }).elements[1].scale).toBe(3);
    const removed = removeElement(design, 'aaaaaaa1');
    expect(removed.elements).toEqual([el({ id: 'aaaaaaa2', z: 0 })]);
  });

  it('shiftLayer swaps with the neighbour and stops at the ends', () => {
    const design = withElements([
      el({ id: 'aaaaaaa1', z: 0 }),
      el({ id: 'aaaaaaa2', z: 1 }),
      el({ id: 'aaaaaaa3', z: 2 }),
    ]);
    const up = shiftLayer(design, 'aaaaaaa1', 1);
    expect(paintOrder(up.elements).map((e) => e.id)).toEqual(['aaaaaaa2', 'aaaaaaa1', 'aaaaaaa3']);
    expect(shiftLayer(design, 'aaaaaaa3', 1)).toBe(design);
    expect(shiftLayer(design, 'aaaaaaa1', -1)).toBe(design);
  });

  it('normalizeZ keeps order and breaks ties by list position', () => {
    const els = [
      el({ id: 'aaaaaaa1', z: 5 }),
      el({ id: 'aaaaaaa2', z: 5 }),
      el({ id: 'aaaaaaa3', z: 1 }),
    ];
    expect(normalizeZ(els).map((e) => e.z)).toEqual([1, 2, 0]);
  });
});
