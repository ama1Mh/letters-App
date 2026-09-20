/**
 * TEMPORARY (Phase 1 spike, OPEN-4). Delete with app/spike.tsx once findings are recorded in
 * docs/DECISIONS.md. Pure TypeScript: no React Native imports, so it also runs under Jest/Node.
 */

export interface IntlProbeRow {
  /** What was requested, e.g. the locale tag passed to Intl. */
  label: string;
  date: string;
  number: string;
  /** Calendar and numbering system the engine actually resolved. */
  calendar: string;
  numberingSystem: string;
}

/** A fixed instant so results are comparable across devices and runs. */
export const PROBE_DATE = new Date(Date.UTC(2026, 8, 20, 15, 30, 0));
export const PROBE_NUMBER = 1234567.89;

/** Explicit tags are what the app uses (DEC-014); the bare ones show what would go wrong. */
export const PROBE_LOCALES = [
  'en-u-ca-gregory-nu-latn',
  'ar-u-ca-gregory-nu-latn',
  'ar',
  'ar-SA',
  'en-US',
] as const;

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'UTC',
};

function probeLocale(locale: string): IntlProbeRow {
  try {
    const dateFormat = new Intl.DateTimeFormat(locale, DATE_OPTIONS);
    const resolved = dateFormat.resolvedOptions();
    return {
      label: locale,
      date: dateFormat.format(PROBE_DATE),
      number: new Intl.NumberFormat(locale).format(PROBE_NUMBER),
      calendar: resolved.calendar,
      numberingSystem: resolved.numberingSystem,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { label: locale, date: reason, number: '-', calendar: '-', numberingSystem: '-' };
  }
}

export function probeIntl(): IntlProbeRow[] {
  return PROBE_LOCALES.map(probeLocale);
}

export const PLURAL_SAMPLES = [0, 1, 2, 3, 11, 100] as const;

/** Arabic needs all six CLDR categories; Hermes/ICU support is what we are checking. */
export function probeArabicPlurals(): { count: number; category: string }[] {
  const rules = new Intl.PluralRules('ar');
  return PLURAL_SAMPLES.map((count) => ({ count, category: rules.select(count) }));
}

const STRONG_RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/u;
const STRONG_LTR = /[A-Za-zÀ-ɏ]/u;

/** First-strong direction of a text, ignoring digits/punctuation. `null` when undecidable. */
export function firstStrongDirection(text: string): 'ltr' | 'rtl' | null {
  for (const char of text) {
    if (STRONG_RTL.test(char)) return 'rtl';
    if (STRONG_LTR.test(char)) return 'ltr';
  }
  return null;
}
