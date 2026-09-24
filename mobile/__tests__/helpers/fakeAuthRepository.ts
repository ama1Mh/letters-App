/**
 * In-memory `AuthRepository` for tests (mirrors the injected-store pattern already used for
 * `encryptedStorage.ts`). Fixed test fixtures, not a general mock server:
 *   sign in  "sara@example.test" / "correct-horse"           -> succeeds
 *   sign up  "taken@example.test"                             -> user_already_exists
 *   onboard  username "taken"                                 -> username_unavailable
 * Anything else behaves as the "happy path" so tests only need to name the case they care about.
 */
import {
  AuthActionError,
  type AuthRepository,
  type AuthSession,
  type OwnProfile,
} from '@/data/supabase/auth';

export interface FakeAuthBackend {
  repository: AuthRepository;
  /** Simulates a change from outside the screen under test (e.g. sign-out on another screen). */
  setSession(session: AuthSession | null): void;
}

export function fakeProfile(userId: string, overrides: Partial<OwnProfile> = {}): OwnProfile {
  return {
    id: userId,
    username: null,
    displayName: null,
    avatarKey: null,
    locale: 'en',
    receiveMode: 'invite_only',
    discoverableByUsername: true,
    discoverableByEmail: false,
    readReceiptsEnabled: true,
    onboardedAt: null,
    ...overrides,
  };
}

export function createFakeAuthRepository(initial?: {
  session?: AuthSession | null;
  profile?: OwnProfile | null;
}): FakeAuthBackend {
  let session: AuthSession | null = initial?.session ?? null;
  let profile: OwnProfile | null = initial?.profile ?? null;
  const listeners = new Set<(session: AuthSession | null) => void>();

  function notify() {
    for (const listener of listeners) listener(session);
  }

  const repository: AuthRepository = {
    async getSession() {
      return session;
    },

    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },

    async getOwnProfile(userId) {
      return profile && profile.id === userId ? profile : null;
    },

    async signUpWithPassword({ email }) {
      if (email === 'taken@example.test') throw new AuthActionError('user_already_exists');
      return { needsEmailConfirmation: true };
    },

    async signInWithPassword({ email, password }) {
      if (email === 'sara@example.test' && password === 'correct-horse') {
        session = { userId: 'user-sara' };
        profile ??= fakeProfile('user-sara');
        notify();
        return;
      }
      throw new AuthActionError('invalid_credentials');
    },

    async signOut() {
      session = null;
      profile = null;
      notify();
    },

    async requestPasswordReset() {
      // Always resolves: Supabase never reveals whether the email exists.
    },

    async checkUsernameAvailable(username) {
      if (!session) throw new AuthActionError('not_authenticated');
      return username !== 'taken';
    },

    async completeOnboarding({ username, displayName, locale, discoverableByEmail }) {
      if (!session) throw new AuthActionError('not_authenticated');
      if (username === 'taken') throw new AuthActionError('username_unavailable');
      profile = {
        ...(profile ?? fakeProfile(session.userId)),
        username,
        displayName,
        locale,
        discoverableByEmail,
        onboardedAt: new Date().toISOString(),
      };
    },

    async updateReceiveSettings({ receiveMode, discoverableByUsername, discoverableByEmail }) {
      if (!session) throw new AuthActionError('not_authenticated');
      profile = {
        ...(profile ?? fakeProfile(session.userId)),
        receiveMode,
        discoverableByUsername,
        discoverableByEmail,
      };
    },
  };

  return {
    repository,
    setSession(next) {
      session = next;
      if (!next) profile = null;
      notify();
    },
  };
}
