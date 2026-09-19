import { formatDate, formatNumber } from '../src/core/i18n/format';
import {
  INTL_LOCALES,
  isRtlLanguage,
  languageFromDevice,
  resolveLanguage,
} from '../src/core/i18n/languages';

describe('language resolution', () => {
  it('follows the device language when it is ar or en', () => {
    expect(languageFromDevice('ar')).toBe('ar');
    expect(languageFromDevice('en')).toBe('en');
    expect(languageFromDevice('AR')).toBe('ar');
  });

  it('falls back to en for other or missing device languages', () => {
    expect(languageFromDevice('fr')).toBe('en');
    expect(languageFromDevice('')).toBe('en');
    expect(languageFromDevice(null)).toBe('en');
    expect(languageFromDevice(undefined)).toBe('en');
  });

  it('honours an explicit preference over the device language', () => {
    expect(resolveLanguage('en', 'ar')).toBe('en');
    expect(resolveLanguage('ar', 'en')).toBe('ar');
    expect(resolveLanguage('system', 'ar')).toBe('ar');
    expect(resolveLanguage('system', 'de')).toBe('en');
  });

  it('treats only Arabic as RTL', () => {
    expect(isRtlLanguage('ar')).toBe(true);
    expect(isRtlLanguage('en')).toBe(false);
  });
});

describe('Intl locale tags (DEC-014)', () => {
  it('pin the Gregorian calendar and Latin digits explicitly', () => {
    expect(INTL_LOCALES.ar).toBe('ar-u-ca-gregory-nu-latn');
    expect(INTL_LOCALES.en).toBe('en-u-ca-gregory-nu-latn');
  });

  // Node's ICU stands in for Hermes here; the real on-device check is the Phase 1 spike.
  it('formats numbers with Western digits in Arabic', () => {
    expect(formatNumber(1234567, 'ar')).toMatch(/^[0-9,.٫٬  ،]+$/);
    expect(formatNumber(2026, 'ar', { useGrouping: false })).toBe('2026');
  });

  it('formats dates with Western digits and the Gregorian calendar in Arabic', () => {
    const date = new Date(Date.UTC(2026, 8, 19, 12));
    const text = formatDate(date, 'ar', { dateStyle: 'medium', timeZone: 'UTC' });
    expect(text).toMatch(/2026/);
    expect(text).not.toMatch(/[٠-٩]/);
    expect(new Intl.DateTimeFormat(INTL_LOCALES.ar).resolvedOptions().calendar).toBe('gregory');
  });

  it('formats English dates with the Gregorian calendar', () => {
    const date = new Date(Date.UTC(2026, 8, 19, 12));
    expect(formatDate(date, 'en', { dateStyle: 'medium', timeZone: 'UTC' })).toBe('Sep 19, 2026');
  });
});
