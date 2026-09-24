import Storage from 'expo-sqlite/kv-store';
import { renderRouter } from 'expo-router/testing-library';
import { I18nManager } from 'react-native';

import type { DraftsRepository } from '@/data/letters/draftsRepository';
import { getDraftsRepository } from '@/data/letters/draftsRepository';
import type { LocalDraft } from '@/data/local/draftsStore';
import { getAuthRepository, type AuthSession, type OwnProfile } from '@/data/supabase/auth';

import { initI18n } from '../../src/core/i18n';
import { createFakeAuthRepository, fakeProfile, type FakeAuthBackend } from './fakeAuthRepository';
import { createFakeDraftsRepository } from './fakeDraftsRepository';

// The app never mocks these: the real getters always reach a real backend (Supabase, expo-sqlite).
// Tests replace them with fakes so the shell renders without native modules or a server.
jest.mock('@/data/supabase/auth', () => ({
  ...jest.requireActual('@/data/supabase/auth'),
  getAuthRepository: jest.fn(),
}));
jest.mock('@/data/letters/draftsRepository', () => ({
  ...jest.requireActual('@/data/letters/draftsRepository'),
  getDraftsRepository: jest.fn(),
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
export async function renderShellIn(
  language: 'en' | 'ar',
  authOverride?: AuthOverride,
  initialDrafts: LocalDraft[] = [],
) {
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

  const drafts: DraftsRepository = createFakeDraftsRepository(initialDrafts);
  (getDraftsRepository as jest.Mock).mockReturnValue(drafts);

  Storage.setItemSync('i18n.languagePreference', language);
  initI18n();
  // `renderRouter()`'s result is itself thenable (RNTL 14's render() is async): returning
  // `Object.assign(renderRouter(...), extras)` directly from this async function would make the
  // outer Promise *adopt* that thenable's resolution instead of resolving with our extended object,
  // silently dropping `backend`/`drafts`. Awaiting it first collapses it to a plain object.
  const rendered = await renderRouter('./app');
  return Object.assign(rendered, { backend, drafts });
}

// Cold first render loads expo-router and every screen.
jest.setTimeout(30_000);
