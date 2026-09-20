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

/** Which Intl constructors this JS engine actually provides (Hermes ships only some of them). */
export const INTL_FEATURES = [
  'DateTimeFormat',
  'NumberFormat',
  'PluralRules',
  'RelativeTimeFormat',
  'ListFormat',
  'Collator',
  'Segmenter',
  'Locale',
  'DisplayNames',
  'getCanonicalLocales',
] as const;

export function probeIntlSupport(): { feature: string; available: boolean }[] {
  const intl = (globalThis as { Intl?: Record<string, unknown> }).Intl;
  return INTL_FEATURES.map((feature) => ({
    feature,
    available: typeof intl?.[feature] === 'function',
  }));
}

/** Availability only: Hermes reports every function as native code, so we cannot tell a polyfill apart. */
export function formatIntlSupport(): string {
  return probeIntlSupport()
    .map(({ feature, available }) => feature + ':' + (available ? 'yes' : 'NO'))
    .join('  ');
}

/**
 * Plural category per sample count. Arabic needs all six CLDR categories, English two. Returns
 * null when `Intl.PluralRules` is missing (the spike's original finding, DEC-037).
 */
export function probePlurals(locale: string): { count: number; category: string }[] | null {
  if (typeof Intl === 'undefined' || typeof Intl.PluralRules !== 'function') return null;
  const rules = new Intl.PluralRules(locale);
  return PLURAL_SAMPLES.map((count) => ({ count, category: rules.select(count) }));
}

// Code-point ranges (not regex escapes): Hebrew/Arabic blocks and Arabic presentation forms.
function isStrongRtl(code: number): boolean {
  return (
    (code >= 0x0590 && code <= 0x08ff) ||
    (code >= 0xfb1d && code <= 0xfdff) ||
    (code >= 0xfe70 && code <= 0xfeff)
  );
}

function isStrongLtr(code: number): boolean {
  return (
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a) ||
    (code >= 0xc0 && code <= 0x24f)
  );
}

/** First-strong direction of a text, ignoring digits/punctuation. `null` when undecidable. */
export function firstStrongDirection(text: string): 'ltr' | 'rtl' | null {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (isStrongRtl(code)) return 'rtl';
    if (isStrongLtr(code)) return 'ltr';
  }
  return null;
}
