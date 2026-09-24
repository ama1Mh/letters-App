import Storage from 'expo-sqlite/kv-store';
import { renderRouter } from 'expo-router/testing-library';
import { I18nManager } from 'react-native';

import { getAuthRepository, type AuthSession, type OwnProfile } from '@/data/supabase/auth';

import { initI18n } from '../../src/core/i18n';
import { createFakeAuthRepository, fakeProfile, type FakeAuthBackend } from './fakeAuthRepository';

// The app never mocks this: `getAuthRepository()` always reaches the real Supabase-backed
// repository. Tests replace it with a fake so the shell renders without native modules or a
// backend (see fakeAuthRepository.ts).
jest.mock('@/data/supabase/auth', () => ({
  ...jest.requireActual('@/data/supabase/auth'),
  getAuthRepository: jest.fn(),
}));

export interface AuthOverride {
  session?: AuthSession | null;
  profile?: OwnProfile | null;
}

/**
 * Renders the real `app/` route tree in the given UI language, with the layout direction React
 * Native would have for that language (so no direction-change reload is triggered).
 *
 * Auth defaults to an already signed-in, already-onboarded user, so the tab shell renders directly
 * (most tests using this helper are testing the shell, not the auth gate). Pass `authOverride` to
 * exercise other gate states (see auth-gate.test.tsx).
 *
 * Expo Router keeps a global router store and RNTL unmounts after every test, so use ONE test per
 * file that calls this: a second render would start from the previous test's navigation state.
 */
export async function renderShellIn(language: 'en' | 'ar', authOverride?: AuthOverride) {
  jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => {});
  jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => {});
  jest.spyOn(I18nManager, 'getConstants').mockReturnValue({
    isRTL: language === 'ar',
    doLeftAndRightSwapInRTL: true,
    localeIdentifier: language,
  });

  const backend: FakeAuthBackend = createFakeAuthRepository(
    authOverride ?? {
      session: { userId: 'user-shell' },
      profile: fakeProfile('user-shell', {
        username: 'shell_user',
        displayName: 'Shell User',
        onboardedAt: new Date().toISOString(),
      }),
    },
  );
  (getAuthRepository as jest.Mock).mockReturnValue(backend.repository);

  Storage.setItemSync('i18n.languagePreference', language);
  initI18n();
  return Object.assign(renderRouter('./app'), { backend });
}

// Cold first render loads expo-router and every screen.
jest.setTimeout(30_000);
