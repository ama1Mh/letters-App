/**
 * Unit tests for the real `AuthRepository` implementation (createSupabaseAuthRepository), over a
 * minimal fake shaped like the slice of `SupabaseClient` it actually calls. Screen-level tests use
 * `fakeAuthRepository.ts` instead; this file is the one place that checks the error-code mapping
 * (`error.code` for Auth errors, `error.message` for our own RPC exceptions) against realistic
 * Supabase-shaped errors.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { AuthActionError, createSupabaseAuthRepository } from '@/data/supabase/auth';

type Overrides = {
  signUp?: unknown;
  signInWithPassword?: unknown;
  resetPasswordForEmail?: unknown;
  rpc?: unknown;
  profileRow?: Record<string, unknown> | null;
  fromError?: unknown;
  sessionUserId?: string;
  updateError?: unknown;
  onUpdate?: (payload: unknown, id: string) => void;
};

function fakeClient(overrides: Overrides = {}) {
  return {
    auth: {
      getSession: async () => ({
        data: {
          session: overrides.sessionUserId ? { user: { id: overrides.sessionUserId } } : null,
        },
      }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
      signUp: overrides.signUp,
      signInWithPassword: overrides.signInWithPassword,
      resetPasswordForEmail: overrides.resetPasswordForEmail,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            overrides.fromError
              ? { data: null, error: overrides.fromError }
              : { data: overrides.profileRow ?? null, error: null },
        }),
      }),
      update: (payload: unknown) => ({
        eq: async (_col: string, id: string) => {
          overrides.onUpdate?.(payload, id);
          return { error: overrides.updateError ?? null };
        },
      }),
    }),
    rpc: overrides.rpc,
  } as unknown as SupabaseClient;
}

describe('createSupabaseAuthRepository', () => {
  describe('signUpWithPassword', () => {
    it('needsEmailConfirmation is true when signUp returns no session (the DEC-038 default)', async () => {
      const repo = createSupabaseAuthRepository(
        fakeClient({ signUp: async () => ({ data: { session: null }, error: null }) }),
      );
      await expect(
        repo.signUpWithPassword({ email: 'a@example.test', password: 'x', locale: 'en' }),
      ).resolves.toEqual({ needsEmailConfirmation: true });
    });

    it('needsEmailConfirmation is false when a session comes back', async () => {
      const repo = createSupabaseAuthRepository(
        fakeClient({ signUp: async () => ({ data: { session: {} }, error: null }) }),
      );
      await expect(
        repo.signUpWithPassword({ email: 'a@example.test', password: 'x', locale: 'en' }),
      ).resolves.toEqual({ needsEmailConfirmation: false });
    });

    it('maps a known Auth error code', async () => {
      const repo = createSupabaseAuthRepository(
        fakeClient({
          signUp: async () => ({ data: { session: null }, error: { code: 'user_already_exists' } }),
        }),
      );
      await expect(
        repo.signUpWithPassword({ email: 'a@example.test', password: 'x', locale: 'en' }),
      ).rejects.toEqual(new AuthActionError('user_already_exists'));
    });

    it('falls back to "unknown" for an error code this caller does not declare (e.g. a sign-in code)', async () => {
      const repo = createSupabaseAuthRepository(
        fakeClient({
          signUp: async () => ({ data: { session: null }, error: { code: 'invalid_credentials' } }),
        }),
      );
      await expect(
        repo.signUpWithPassword({ email: 'a@example.test', password: 'x', locale: 'en' }),
      ).rejects.toEqual(new AuthActionError('unknown'));
    });

    it('falls back to "unknown" for an error with neither code nor message', async () => {
      const repo = createSupabaseAuthRepository(
        fakeClient({ signUp: async () => ({ data: { session: null }, error: {} }) }),
      );
      await expect(
        repo.signUpWithPassword({ email: 'a@example.test', password: 'x', locale: 'en' }),
      ).rejects.toEqual(new AuthActionError('unknown'));
    });
  });

  describe('signInWithPassword', () => {
    it('maps invalid_credentials', async () => {
      const repo = createSupabaseAuthRepository(
        fakeClient({
          signInWithPassword: async () => ({ error: { code: 'invalid_credentials' } }),
        }),
      );
      await expect(
        repo.signInWithPassword({ email: 'a@example.test', password: 'wrong' }),
      ).rejects.toEqual(new AuthActionError('invalid_credentials'));
    });

    it('resolves on success', async () => {
      const repo = createSupabaseAuthRepository(
        fakeClient({ signInWithPassword: async () => ({ error: null }) }),
      );
      await expect(
        repo.signInWithPassword({ email: 'a@example.test', password: 'correct' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('completeOnboarding / checkUsernameAvailable (RPC exception message is the code)', () => {
    it('maps a known RPC exception message to a code', async () => {
      const repo = createSupabaseAuthRepository(
        fakeClient({
          rpc: async () => ({ data: null, error: { message: 'username_unavailable' } }),
        }),
      );
      await expect(
        repo.completeOnboarding({
          username: 'sara',
          displayName: 'Sara',
          locale: 'en',
          discoverableByEmail: false,
        }),
      ).rejects.toEqual(new AuthActionError('username_unavailable'));
    });

    it('falls back to "unknown" for an unrecognized RPC message', async () => {
      const repo = createSupabaseAuthRepository(
        fakeClient({
          rpc: async () => ({
            data: null,
            error: { message: 'permission denied for table profiles' },
          }),
        }),
      );
      await expect(
        repo.completeOnboarding({
          username: 'sara',
          displayName: 'Sara',
          locale: 'en',
          discoverableByEmail: false,
        }),
      ).rejects.toEqual(new AuthActionError('unknown'));
    });

    it('checkUsernameAvailable returns the RPC boolean', async () => {
      const repo = createSupabaseAuthRepository(
        fakeClient({ rpc: async () => ({ data: true, error: null }) }),
      );
      await expect(repo.checkUsernameAvailable('sara')).resolves.toBe(true);
    });
  });

  describe('getOwnProfile', () => {
    it('maps a snake_case row to OwnProfile, and null to null', async () => {
      const repo = createSupabaseAuthRepository(
        fakeClient({
          profileRow: {
            id: 'user-1',
            username: 'sara_92',
            display_name: 'سارة',
            avatar_key: null,
            locale: 'ar',
            receive_mode: 'invite_only',
            discoverable_by_username: true,
            discoverable_by_email: false,
            read_receipts_enabled: true,
            onboarded_at: '2026-09-21T00:00:00.000Z',
          },
        }),
      );
      await expect(repo.getOwnProfile('user-1')).resolves.toEqual({
        id: 'user-1',
        username: 'sara_92',
        displayName: 'سارة',
        avatarKey: null,
        locale: 'ar',
        receiveMode: 'invite_only',
        discoverableByUsername: true,
        discoverableByEmail: false,
        readReceiptsEnabled: true,
        onboardedAt: '2026-09-21T00:00:00.000Z',
      });

      const empty = createSupabaseAuthRepository(fakeClient({ profileRow: null }));
      await expect(empty.getOwnProfile('user-1')).resolves.toBeNull();
    });

    it('throws the raw error when the query fails', async () => {
      const repo = createSupabaseAuthRepository(fakeClient({ fromError: new Error('boom') }));
      await expect(repo.getOwnProfile('user-1')).rejects.toThrow('boom');
    });
  });

  describe('updateReceiveSettings', () => {
    it('updates exactly the DEC-038-granted columns for the current session user', async () => {
      let captured: { payload: unknown; id: string } | null = null;
      const repo = createSupabaseAuthRepository(
        fakeClient({
          sessionUserId: 'user-1',
          onUpdate: (payload, id) => {
            captured = { payload, id };
          },
        }),
      );
      await expect(
        repo.updateReceiveSettings({
          receiveMode: 'everyone',
          discoverableByUsername: false,
          discoverableByEmail: true,
        }),
      ).resolves.toBeUndefined();
      expect(captured).toEqual({
        payload: {
          receive_mode: 'everyone',
          discoverable_by_username: false,
          discoverable_by_email: true,
        },
        id: 'user-1',
      });
    });

    it('throws not_authenticated with no session', async () => {
      const repo = createSupabaseAuthRepository(fakeClient());
      await expect(
        repo.updateReceiveSettings({
          receiveMode: 'everyone',
          discoverableByUsername: true,
          discoverableByEmail: false,
        }),
      ).rejects.toEqual(new AuthActionError('not_authenticated'));
    });

    it('throws unknown when the update fails', async () => {
      const repo = createSupabaseAuthRepository(
        fakeClient({ sessionUserId: 'user-1', updateError: new Error('db down') }),
      );
      await expect(
        repo.updateReceiveSettings({
          receiveMode: 'everyone',
          discoverableByUsername: true,
          discoverableByEmail: false,
        }),
      ).rejects.toEqual(new AuthActionError('unknown'));
    });
  });
});
