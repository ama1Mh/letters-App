import { DevSettings, I18nManager } from 'react-native';

import { isRtlLanguage, type Language } from './languages';

/** The direction React Native is actually laying out with (fixed at app start). */
export function isLayoutRtl(): boolean {
  return I18nManager.getConstants().isRTL;
}

/**
 * The `textAlign` that puts text of direction `dir` on its own start side (physical left for ltr,
 * right for rtl) whatever the UI direction. Needed because `<Text>` does not align by its content's
 * direction, and on Android React Native swaps 'left'/'right' in an RTL layout
 * (`doLeftAndRightSwapInRTL`, on by default): a plain `'left'` for an English letter would render on
 * the right inside the Arabic UI (found on the device, Phase 6 M8). Use together with
 * `writingDirection: dir`.
 */
export function contentTextAlign(dir: 'ltr' | 'rtl'): 'left' | 'right' {
  const physical = dir === 'rtl' ? 'right' : 'left';
  const { isRTL, doLeftAndRightSwapInRTL } = I18nManager.getConstants();
  if (!isRTL || !doLeftAndRightSwapInRTL) return physical;
  return physical === 'left' ? 'right' : 'left';
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
 * Whether this build can restart its JS bundle in-process (so a direction change applies at once).
 * Dev builds: yes (DevSettings). Release builds: not until `expo-updates` is set up (OPEN-8, needs
 * an EAS project); they apply the new direction on the next launch instead - callers check this
 * rather than calling reloadApp() and crashing.
 */
export function canReloadApp(): boolean {
  return __DEV__;
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
