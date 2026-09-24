import ar from '../src/core/i18n/locales/ar.json';
import en from '../src/core/i18n/locales/en.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const flatEn = flatten(en);
const flatAr = flatten(ar);

// Values that are intentionally identical in both languages.
const SAME_IN_BOTH = new Set([
  'app.name',
  'language.english',
  'language.arabic',
  // Font names are proper nouns (PLAN §3.8); not translated, same as the language endonyms above.
  'design.fontNames.caveat',
  'design.fontNames.playfair_display',
  'design.fontNames.cairo',
  'design.fontNames.tajawal',
  'design.fontNames.amiri',
]);

describe('locale files', () => {
  it('have exactly the same keys', () => {
    expect(Object.keys(flatAr).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it('have no empty strings', () => {
    for (const [key, value] of [...Object.entries(flatEn), ...Object.entries(flatAr)]) {
      expect({ key, empty: value.trim() === '' }).toEqual({ key, empty: false });
    }
  });

  it('do not leave untranslated English in ar.json', () => {
    for (const [key, value] of Object.entries(flatAr)) {
      if (SAME_IN_BOTH.has(key)) continue;
      expect({ key, sameAsEnglish: value === flatEn[key] }).toEqual({ key, sameAsEnglish: false });
    }
  });

  it('use Western digits only (no Arabic-Indic digits)', () => {
    for (const [key, value] of Object.entries(flatAr)) {
      expect({ key, hasArabicIndic: /[٠-٩۰-۹]/.test(value) }).toEqual({
        key,
        hasArabicIndic: false,
      });
    }
  });
});
