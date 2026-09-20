// TEMPORARY with the Phase 1 spike: delete together with src/features/spike/.
import { firstStrongDirection, probePlurals, probeIntl } from '../src/features/spike/intlProbe';

describe('spike intl probe (Node ICU; the real answer for Hermes comes from the device)', () => {
  it('explicit locales give Gregorian dates and Western digits', () => {
    const [en, ar] = probeIntl();
    for (const row of [en, ar]) {
      expect(row.calendar).toBe('gregory');
      expect(row.numberingSystem).toBe('latn');
      expect(row.date).toContain('2026');
      expect(row.date).not.toMatch(/[٠-٩]/);
      expect(row.number).not.toMatch(/[٠-٩]/);
    }
  });

  it('reports plural categories per language', () => {
    expect((probePlurals('ar') ?? []).map((row) => row.category)).toEqual([
      'zero',
      'one',
      'two',
      'few',
      'many',
      'other',
    ]);
    expect((probePlurals('en') ?? []).map((row) => row.category)).toEqual([
      'other',
      'one',
      'other',
      'other',
      'other',
      'other',
    ]);
  });

  it('detects first-strong direction', () => {
    expect(firstStrongDirection('123 مرحباً hello')).toBe('rtl');
    expect(firstStrongDirection('12 hello مرحباً')).toBe('ltr');
    expect(firstStrongDirection('123 !?')).toBeNull();
  });
});
