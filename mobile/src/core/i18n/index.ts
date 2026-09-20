import './polyfills'; // Must stay first: installs Intl.PluralRules before i18next is imported.

import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { applyLayoutDirection, isLayoutRtl, reloadApp } from './direction';
import { resolveLanguage, type Language, type LanguagePreference } from './languages';
import ar from './locales/ar.json';
import en from './locales/en.json';
import {
  getDirectionReloadGuard,
  getLanguagePreference,
  setDirectionReloadGuard,
  setLanguagePreference,
} from './preference';

// An explicit instance (not the implicit global) keeps init order and tests predictable.
export const i18n = createInstance();
export { isLayoutRtl };

export const resources = {
  en: { translation: en },
  ar: { translation: ar },
} as const;

function deviceLanguageCode(): string | null {
  return getLocales()[0]?.languageCode ?? null;
}

export function currentLanguage(): Language {
  return i18n.language === 'ar' ? 'ar' : 'en';
}

/**
 * Initialise i18n once, synchronously, from the stored preference and align the layout direction.
 * If the direction differs from the running layout (e.g. first launch on an Arabic device), reload
 * once; the guard prevents a reload loop if the platform ignores forceRTL.
 */
export function initI18n(): void {
  if (i18n.isInitialized) return;

  const language = resolveLanguage(getLanguagePreference(), deviceLanguageCode());

  void i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'en',
    initAsync: false,
    interpolation: { escapeValue: false }, // React already escapes.
  });

  const { needsReload } = applyLayoutDirection(language);
  if (!needsReload) {
    setDirectionReloadGuard(null);
  } else if (getDirectionReloadGuard() !== language) {
    setDirectionReloadGuard(language);
    reloadApp();
  } else {
    console.warn(`Layout direction for "${language}" did not apply after a reload; not retrying.`);
  }
}

/**
 * Persist and apply a language preference. `needsReload` means the layout direction changed; the
 * caller must confirm with the user and then call `reloadApp()`.
 */
export async function changeLanguagePreference(
  preference: LanguagePreference,
): Promise<{ language: Language; needsReload: boolean }> {
  const language = resolveLanguage(preference, deviceLanguageCode());
  setLanguagePreference(preference);
  await i18n.changeLanguage(language);
  const { needsReload } = applyLayoutDirection(language);
  setDirectionReloadGuard(null);
  return { language, needsReload };
}
