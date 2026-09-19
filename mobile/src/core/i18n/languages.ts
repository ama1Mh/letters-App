/** Supported UI languages and pure resolution rules (DEC-014). No React Native imports. */

export const LANGUAGES = ['en', 'ar'] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_PREFERENCES = ['system', ...LANGUAGES] as const;
export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';
export const DEFAULT_PREFERENCE: LanguagePreference = 'system';

const RTL_LANGUAGES: readonly Language[] = ['ar'];

/**
 * Explicit Unicode extensions: Gregorian calendar + Western (Latin) digits in both languages.
 * Never use a bare `ar` / `ar-SA` — some engines default to Hijri or Arabic-Indic digits.
 */
export const INTL_LOCALES: Record<Language, string> = {
  en: 'en-u-ca-gregory-nu-latn',
  ar: 'ar-u-ca-gregory-nu-latn',
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return typeof value === 'string' && (LANGUAGE_PREFERENCES as readonly string[]).includes(value);
}

export function isRtlLanguage(language: Language): boolean {
  return RTL_LANGUAGES.includes(language);
}

/** Device language if it is `ar` or `en`, otherwise `en`. */
export function languageFromDevice(deviceLanguageCode: string | null | undefined): Language {
  const code = deviceLanguageCode?.toLowerCase();
  return isLanguage(code) ? code : DEFAULT_LANGUAGE;
}

export function resolveLanguage(
  preference: LanguagePreference,
  deviceLanguageCode: string | null | undefined,
): Language {
  return preference === 'system' ? languageFromDevice(deviceLanguageCode) : preference;
}
