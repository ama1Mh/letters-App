import { DevSettings, I18nManager } from 'react-native';

import { isRtlLanguage, type Language } from './languages';

/** The direction React Native is actually laying out with (fixed at app start). */
export function isLayoutRtl(): boolean {
  return I18nManager.getConstants().isRTL;
}

/**
 * Tells React Native which direction the next app start must use. RN fixes layout direction at
 * startup, so a mismatch with the current layout means a reload is needed (en <-> ar only).
 */
export function applyLayoutDirection(language: Language): { needsReload: boolean } {
  const wantRtl = isRtlLanguage(language);
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(wantRtl);
  return { needsReload: isLayoutRtl() !== wantRtl };
}

/**
 * Restarts the JS bundle so a new layout direction takes effect.
 * Dev builds: DevSettings.reload(). Production needs `expo-updates` (`reloadAsync`) — not
 * installed yet, see OPEN-8 in docs/DECISIONS.md. Fail loudly rather than silently doing nothing.
 */
export function reloadApp(): void {
  if (__DEV__) {
    DevSettings.reload();
    return;
  }
  throw new Error('reloadApp: production reload is not implemented yet (OPEN-8, expo-updates).');
}
