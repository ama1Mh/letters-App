// Hermes has no Intl.PluralRules (DEC-037). Node does, so remove it, load our polyfill entry and
// check that English and Arabic plural forms (including through i18next) still resolve.
const nativePluralRules = Intl.PluralRules;

describe('Intl.PluralRules polyfill', () => {
  beforeAll(() => {
    Reflect.deleteProperty(Intl, 'PluralRules');
    expect(typeof Intl.PluralRules).toBe('undefined');
    // require (not import): module load order is the point of this test.
    jest.isolateModules(() => {
      require('../src/core/i18n/polyfills');
    });
  });

  afterAll(() => {
    Object.defineProperty(Intl, 'PluralRules', {
      value: nativePluralRules,
      configurable: true,
      writable: true,
    });
  });

  it('installs a JS implementation when the engine has none', () => {
    expect(typeof Intl.PluralRules).toBe('function');
    expect(Intl.PluralRules).not.toBe(nativePluralRules);
  });

  it('matches the native English categories', () => {
    const rules = new Intl.PluralRules('en');
    const native = new nativePluralRules('en');
    for (const count of [0, 1, 2, 5, 21, 100]) {
      expect(rules.select(count)).toBe(native.select(count));
    }
    expect(rules.select(1)).toBe('one');
    expect(rules.select(2)).toBe('other');
  });

  it('matches the native Arabic categories (all six)', () => {
    const rules = new Intl.PluralRules('ar');
    const native = new nativePluralRules('ar');
    const expected: Record<number, string> = {
      0: 'zero',
      1: 'one',
      2: 'two',
      3: 'few',
      10: 'few',
      11: 'many',
      99: 'many',
      100: 'other',
      101: 'other',
      102: 'other',
    };
    for (const [count, category] of Object.entries(expected)) {
      expect(rules.select(Number(count))).toBe(category);
      expect(rules.select(Number(count))).toBe(native.select(Number(count)));
    }
  });

  it('lets i18next pick the right plural key in both languages', async () => {
    let i18n!: ReturnType<typeof import('i18next').createInstance>;
    jest.isolateModules(() => {
      i18n = require('i18next').createInstance();
    });
    await i18n.init({
      lng: 'ar',
      fallbackLng: 'en',
      resources: {
        en: { translation: { item_one: 'one item', item_other: '{{count}} items' } },
        ar: {
          translation: {
            item_zero: 'zero',
            item_one: 'one',
            item_two: 'two',
            item_few: 'few {{count}}',
            item_many: 'many {{count}}',
            item_other: 'other {{count}}',
          },
        },
      },
    });
    // The app's typed resources don't know this ad-hoc test key, so call t() untyped.
    const t = i18n.t as unknown as (key: string, options: { count: number }) => string;
    const ar = (count: number) => t('item', { count });
    expect([0, 1, 2, 3, 11, 100].map(ar)).toEqual([
      'zero',
      'one',
      'two',
      'few 3',
      'many 11',
      'other 100',
    ]);

    await i18n.changeLanguage('en');
    expect(t('item', { count: 1 })).toBe('one item');
    expect(t('item', { count: 5 })).toBe('5 items');
  });
});
