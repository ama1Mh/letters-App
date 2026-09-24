import {
  DESIGN_CATALOG,
  defaultDesign,
  fontsForDirection,
  inkOf,
  normalizeDesign,
  paperOf,
  resolveFont,
  stampOf,
} from '@/domain/design';

describe('design catalog', () => {
  it("matches PLAN §7's counts (~6 papers, ~5 fonts, ~8 inks, ~4 stamps)", () => {
    expect(DESIGN_CATALOG.papers.length).toBe(6);
    expect(DESIGN_CATALOG.fonts.length).toBe(5);
    expect(DESIGN_CATALOG.inks.length).toBe(8);
    expect(DESIGN_CATALOG.stamps.length).toBe(4);
  });

  it('has at least one Arabic-capable font, and every fallback font key exists in the catalog', () => {
    expect(DESIGN_CATALOG.fonts.some((f) => f.scripts.includes('arabic'))).toBe(true);
    for (const key of Object.values(DESIGN_CATALOG.fallbackFonts)) {
      expect(DESIGN_CATALOG.fonts.some((f) => f.key === key)).toBe(true);
    }
  });

  it('every default references a real catalog entry', () => {
    const { defaults } = DESIGN_CATALOG;
    expect(DESIGN_CATALOG.papers.some((p) => p.key === defaults.paper)).toBe(true);
    expect(DESIGN_CATALOG.fonts.some((f) => f.key === defaults.font)).toBe(true);
    expect(DESIGN_CATALOG.inks.some((i) => i.key === defaults.ink)).toBe(true);
  });
});

describe('normalizeDesign', () => {
  it('accepts a well-formed design unchanged', () => {
    const design = {
      v: 1,
      paper: 'sky',
      font: 'amiri',
      ink: 'navy',
      layout: 'standard' as const,
      stamp: 'heart',
      stickers: [] as const,
    };
    expect(normalizeDesign(design)).toEqual(design);
  });

  it('falls back to the default design rather than throwing, for every kind of bad input', () => {
    const bad: unknown[] = [
      null,
      undefined,
      'not an object',
      42,
      {},
      { ...defaultDesign(), v: 2 }, // unknown version
      { ...defaultDesign(), paper: 'gold-foil' }, // unknown key
      { ...defaultDesign(), font: 'comic-sans' },
      { ...defaultDesign(), ink: 'invisible' },
      { ...defaultDesign(), stamp: 'unicorn' },
      { ...defaultDesign(), layout: 'fancy' },
      { ...defaultDesign(), stickers: ['one'] }, // reserved: must be empty
    ];
    for (const value of bad) {
      expect(normalizeDesign(value)).toEqual(defaultDesign());
    }
  });

  it('accepts a null stamp (no stamp chosen)', () => {
    expect(normalizeDesign({ ...defaultDesign(), stamp: null }).stamp).toBeNull();
  });
});

describe('paperOf / inkOf / stampOf', () => {
  it('look up the chosen entry', () => {
    const design = { ...defaultDesign(), paper: 'mint', ink: 'teal', stamp: 'star' };
    expect(paperOf(design).key).toBe('mint');
    expect(inkOf(design).key).toBe('teal');
    expect(stampOf(design)?.key).toBe('star');
  });

  it('stampOf returns null when no stamp is chosen', () => {
    expect(stampOf({ ...defaultDesign(), stamp: null })).toBeNull();
  });
});

describe('fontsForDirection / resolveFont (PLAN §3.4 font/script rule)', () => {
  it('offers only Arabic-capable fonts for an rtl letter, and only those for ltr', () => {
    const rtlFonts = fontsForDirection('rtl');
    expect(rtlFonts.length).toBeGreaterThan(0);
    expect(rtlFonts.every((f) => f.scripts.includes('arabic'))).toBe(true);

    const ltrFonts = fontsForDirection('ltr');
    expect(ltrFonts.length).toBeGreaterThan(0);
    expect(ltrFonts.every((f) => f.scripts.includes('latin'))).toBe(true);
  });

  it('uses the chosen font when it supports the script', () => {
    const design = { ...defaultDesign(), font: 'amiri' }; // amiri: latin + arabic
    expect(resolveFont(design, 'rtl').key).toBe('amiri');
    expect(resolveFont(design, 'ltr').key).toBe('amiri');
  });

  it('falls back to the catalog fallback font when the chosen font lacks the script', () => {
    // caveat is latin-only; an rtl (Arabic) letter must fall back, never render with it.
    const design = { ...defaultDesign(), font: 'caveat' };
    const resolved = resolveFont(design, 'rtl');
    expect(resolved.key).toBe(DESIGN_CATALOG.fallbackFonts.arabic);
    expect(resolved.scripts).toContain('arabic');
  });
});
