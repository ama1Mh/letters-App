import Storage from 'expo-sqlite/kv-store';

import { DEFAULT_PREFERENCE, isLanguagePreference, type LanguagePreference } from './languages';

const PREFERENCE_KEY = 'i18n.languagePreference';
const RELOAD_GUARD_KEY = 'i18n.directionReloadFor';

/** Synchronous on purpose: the first render must already know the language and direction. */
export function getLanguagePreference(): LanguagePreference {
  try {
    const stored = Storage.getItemSync(PREFERENCE_KEY);
    return isLanguagePreference(stored) ? stored : DEFAULT_PREFERENCE;
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

export function setLanguagePreference(preference: LanguagePreference): void {
  Storage.setItemSync(PREFERENCE_KEY, preference);
}

/**
 * Loop guard for the direction reload: remembers which language we already reloaded for, so a
 * platform that ignores forceRTL cannot make the app reload forever.
 */
export function getDirectionReloadGuard(): string | null {
  try {
    return Storage.getItemSync(RELOAD_GUARD_KEY);
  } catch {
    return null;
  }
}

export function setDirectionReloadGuard(language: string | null): void {
  try {
    if (language === null) Storage.removeItemSync(RELOAD_GUARD_KEY);
    else Storage.setItemSync(RELOAD_GUARD_KEY, language);
  } catch {
    // Best effort; worst case we skip the guard.
  }
}
