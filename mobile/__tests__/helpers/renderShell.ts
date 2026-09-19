import Storage from 'expo-sqlite/kv-store';
import { renderRouter } from 'expo-router/testing-library';
import { I18nManager } from 'react-native';

import { initI18n } from '../../src/core/i18n';

/**
 * Renders the real `app/` route tree in the given UI language, with the layout direction React
 * Native would have for that language (so no direction-change reload is triggered).
 *
 * Expo Router keeps a global router store and RNTL unmounts after every test, so use ONE test per
 * file that calls this: a second render would start from the previous test's navigation state.
 */
export async function renderShellIn(language: 'en' | 'ar') {
  jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => {});
  jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => {});
  jest.spyOn(I18nManager, 'getConstants').mockReturnValue({
    isRTL: language === 'ar',
    doLeftAndRightSwapInRTL: true,
    localeIdentifier: language,
  });

  Storage.setItemSync('i18n.languagePreference', language);
  initI18n();
  return renderRouter('./app');
}

// Cold first render loads expo-router and every screen.
jest.setTimeout(30_000);
