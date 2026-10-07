/**
 * Auth + own-profile repository (Phase 2). Wraps Supabase Auth and the `profiles` RPCs behind a
 * narrow interface (`AuthRepository`) so screens depend on an abstraction, not the SDK: the same
 * pattern as `BlobStore`/`KeyStore` in encryptedStorage.ts. Tests inject a fake implementation
 * instead of a real `SupabaseClient` (see `__tests__/helpers/fakeAuthRepository.ts`).
 *
 * Errors from Supabase are codes (`error.code`, the stable identifier Supabase documents — not the
 * free-text `message`); our own RPCs raise the codes documented in
 * supabase/migrations/20260921120000_profiles.sql as the exception message. Both are normalized to
 * `AuthActionError<Code>` so callers never branch on translated or free-text strings.
 *
 * No generated DB types exist yet (`supabase gen types` needs a linked project; CLAUDE.md marks
 * `npx supabase …` as not yet verified on this machine). `ProfileRow`/`mapProfileRow` below are
 * hand-written as an interim measure and should be replaced once generation is available.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { currentBrand } from '../../core/config/brand';
import { getSupabase } from './index';

export type AppLocale = 'en' | 'ar';
export type ReceiveMode = 'everyone' | 'invite_only';

export interface AuthSession {
  userId: string;
}

export interface OwnProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarKey: string | null;
  locale: AppLocale;
  receiveMode: ReceiveMode;
  discoverableByUsername: boolean;
  discoverableByEmail: boolean;
  readReceiptsEnabled: boolean;
  /** Push me when a letter is delivered to me (DEC-052). Only silences the push, not delivery. */
  pushOnDelivery: boolean;
  /** Onboarding is complete once this is set (mirrors the `profiles_onboarded_complete` check). */
  onboardedAt: string | null;
  /** Set once the account was deleted (Phase 9); such a session is treated as signed out. */
  deletedAt: string | null;
}

export type SignUpErrorCode =
  | 'user_already_exists'
  | 'weak_password'
  | 'email_address_invalid'
  | 'over_email_send_rate_limit'
  | 'over_request_rate_limit'
  | 'signup_disabled'
  | 'email_provider_disabled'
  | 'unknown';

export type SignInErrorCode =
  'invalid_credentials' | 'email_not_confirmed' | 'over_request_rate_limit' | 'unknown';

export type ResetPasswordErrorCode =
  'over_email_send_rate_limit' | 'over_request_rate_limit' | 'unknown';

/** Setting the new password from a recovery link (OPEN-10). `session_not_found`: the recovery
 *  session is gone (expired or signed out), so the user needs a new link. */
export type UpdatePasswordErrorCode =
  'weak_password' | 'same_password' | 'session_not_found' | 'invalid_link' | 'unknown';

// Codes complete_onboarding() and check_username_available() raise (DEC-038); the exception
// message *is* the code, there is no separate `.code` field on a Postgrest RPC error.
export type OnboardingErrorCode =
  | 'not_authenticated'
  | 'invalid_input'
  | 'username_invalid'
  | 'display_name_invalid'
  | 'username_unavailable'
  | 'display_name_reserved'
  | 'profile_not_found'
  | 'already_onboarded'
  | 'unknown';

/** Thrown by every repository method that can fail; `code` is one of the sets above. Never carries
 *  a free-text server message, so it is always safe to log. */
export class AuthActionError<Code extends string> extends Error {
  readonly code: Code;
  constructor(code: Code) {
    super(`auth action failed: ${code}`);
    this.name = 'AuthActionError';
    this.code = code;
  }
}

export interface AuthRepository {
  /** Current session, read from local storage only (no network call). */
  getSession(): Promise<AuthSession | null>;
  /** Notified on sign-in, sign-out and token refresh elsewhere. Returns an unsubscribe function. */
  subscribe(onChange: (session: AuthSession | null) => void): () => void;
  getOwnProfile(userId: string): Promise<OwnProfile | null>;
  /** Throws `AuthActionError<SignUpErrorCode>`. `needsEmailConfirmation` is true whenever sign-up
   *  did not also return a session (the expected case: DEC-038 has `enable_confirmations = true`). */
  signUpWithPassword(input: {
    email: string;
    password: string;
    locale: AppLocale;
  }): Promise<{ needsEmailConfirmation: boolean }>;
  /** Throws `AuthActionError<SignInErrorCode>`. */
  signInWithPassword(input: { email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
  /** Throws `AuthActionError<ResetPasswordErrorCode>`. Always resolves for an unknown/undiscoverable
   *  email too (Supabase does not reveal account existence), so there is nothing to branch on. */
  requestPasswordReset(email: string): Promise<void>;
  /** Starts the session a password-recovery link carries (OPEN-10). Throws
   *  `AuthActionError<'invalid_link'>` when the tokens are expired, used or malformed. */
  startPasswordRecovery(tokens: { accessToken: string; refreshToken: string }): Promise<void>;
  /** Sets a new password for the current session. Throws `AuthActionError<UpdatePasswordErrorCode>`. */
  updatePassword(password: string): Promise<void>;
  /** Throws `AuthActionError<OnboardingErrorCode>` only for `not_authenticated`; every other case
   *  the RPC itself defines as "false", not an exception. */
  checkUsernameAvailable(username: string): Promise<boolean>;
  /** Throws `AuthActionError<OnboardingErrorCode>`. */
  completeOnboarding(input: {
    username: string;
    displayName: string;
    locale: AppLocale;
    discoverableByEmail: boolean;
  }): Promise<void>;
  /** Direct column update (DEC-038 already grants `authenticated` UPDATE on exactly these columns
   *  - see profiles.sql's `grant update (...)` - so no dedicated RPC exists for this, unlike
   *  onboarding). Throws `AuthActionError<'not_authenticated' | 'unknown'>`. */
  updateReceiveSettings(input: {
    receiveMode: ReceiveMode;
    discoverableByUsername: boolean;
    discoverableByEmail: boolean;
  }): Promise<void>;
  /** Sets (or, with null, removes) the preset avatar (DEC-011). The database checks the key
   *  against the catalog. Throws `AuthActionError<'not_authenticated' | 'unknown'>`. */
  updateAvatar(avatarKey: string | null): Promise<void>;
  /** Turns the delivery push on or off (DEC-052), a direct column update like the two above.
   *  Throws `AuthActionError<'not_authenticated' | 'unknown'>`. */
  updatePushOnDelivery(enabled: boolean): Promise<void>;
  /** Stores the UI language as `profiles.locale`, which the server uses for push text. Throws
   *  `AuthActionError<'not_authenticated' | 'unknown'>`. */
  updateLocale(locale: AppLocale): Promise<void>;
  /** Deletes the signed-in account through the `delete-account` Edge Function (Phase 9), then ends
   *  the local session. Throws `AuthActionError<'not_authenticated' | 'unknown'>`. */
  deleteAccount(): Promise<void>;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_key: string | null;
  locale: AppLocale;
  receive_mode: ReceiveMode;
  discoverable_by_username: boolean;
  discoverable_by_email: boolean;
  read_receipts_enabled: boolean;
  push_on_delivery: boolean;
  onboarded_at: string | null;
  deleted_at: string | null;
}

function mapProfileRow(row: ProfileRow): OwnProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarKey: row.avatar_key,
    locale: row.locale,
    receiveMode: row.receive_mode,
    discoverableByUsername: row.discoverable_by_username,
    discoverableByEmail: row.discoverable_by_email,
    readReceiptsEnabled: row.read_receipts_enabled,
    pushOnDelivery: row.push_on_delivery,
    onboardedAt: row.onboarded_at,
    deletedAt: row.deleted_at,
  };
}

function stringProp(value: object, key: string): string | undefined {
  if (!(key in value)) return undefined;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === 'string' ? raw : undefined;
}

/** Reads `error.code` (an Auth error) or `error.message` (an RPC exception message, which *is* the
 *  code), and returns the first one this caller declared it understands. Both are tried: a
 *  PostgREST error from `raise exception` carries the generic `code` `P0001`, so stopping at a
 *  present-but-unknown `code` turned every database error into 'unknown'. */
function resolveErrorCode<Code extends string>(
  error: unknown,
  knownCodes: readonly Code[],
): Code | 'unknown' {
  if (error === null || typeof error !== 'object') return 'unknown';
  const known = knownCodes as readonly string[];
  for (const candidate of [stringProp(error, 'code'), stringProp(error, 'message')]) {
    if (candidate !== undefined && known.includes(candidate)) return candidate as Code;
  }
  return 'unknown';
}

const SIGN_UP_CODES: readonly SignUpErrorCode[] = [
  'user_already_exists',
  'weak_password',
  'email_address_invalid',
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'signup_disabled',
  'email_provider_disabled',
];
const SIGN_IN_CODES: readonly SignInErrorCode[] = [
  'invalid_credentials',
  'email_not_confirmed',
  'over_request_rate_limit',
];
const RESET_PASSWORD_CODES: readonly ResetPasswordErrorCode[] = [
  'over_email_send_rate_limit',
  'over_request_rate_limit',
];
const UPDATE_PASSWORD_CODES: readonly UpdatePasswordErrorCode[] = [
  'weak_password',
  'same_password',
  'session_not_found',
];
const ONBOARDING_CODES: readonly OnboardingErrorCode[] = [
  'not_authenticated',
  'invalid_input',
  'username_invalid',
  'display_name_invalid',
  'username_unavailable',
  'display_name_reserved',
  'profile_not_found',
  'already_onboarded',
];

const PROFILE_COLUMNS =
  'id, username, display_name, avatar_key, locale, receive_mode, discoverable_by_username, discoverable_by_email, read_receipts_enabled, push_on_delivery, onboarded_at, deleted_at';

/** The real implementation, over a live `SupabaseClient`. Pure of native modules (the client is
 *  injected), so it is unit-testable the same way `createSupabaseClient` is. */
export function createSupabaseAuthRepository(client: SupabaseClient): AuthRepository {
  return {
    async getSession() {
      const { data } = await client.auth.getSession();
      return data.session ? { userId: data.session.user.id } : null;
    },

    subscribe(onChange) {
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, session) => {
        onChange(session ? { userId: session.user.id } : null);
      });
      return () => subscription.unsubscribe();
    },

    async getOwnProfile(userId) {
      const { data, error } = await client
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapProfileRow(data as ProfileRow) : null;
    },

    async signUpWithPassword({ email, password, locale }) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { locale } }, // consumed by handle_new_user() (DEC-038)
      });
      if (error) throw new AuthActionError(resolveErrorCode(error, SIGN_UP_CODES));
      return { needsEmailConfirmation: data.session === null };
    },

    async signInWithPassword({ email, password }) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new AuthActionError(resolveErrorCode(error, SIGN_IN_CODES));
    },

    async signOut() {
      await client.auth.signOut();
    },

    async deleteAccount() {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session) throw new AuthActionError('not_authenticated');
      const { error } = await client.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw new AuthActionError('unknown');
      try {
        // The server already revoked the session; this only clears the local copy.
        await client.auth.signOut({ scope: 'local' });
      } catch {
        // Nothing left to clean up.
      }
    },

    async requestPasswordReset(email) {
      // The link lands on app/(auth)/reset-password via app/+native-intent.tsx. The redirect URL
      // must be allow-listed in the Supabase dashboard (Auth -> URL Configuration), an owner step
      // (OPEN-10 in DECISIONS.md); until then Supabase sends the user to the Site URL instead.
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${currentBrand().scheme}://reset-password`,
      });
      if (error) throw new AuthActionError(resolveErrorCode(error, RESET_PASSWORD_CODES));
    },

    async startPasswordRecovery({ accessToken, refreshToken }) {
      const { error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw new AuthActionError('invalid_link');
    },

    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new AuthActionError(resolveErrorCode(error, UPDATE_PASSWORD_CODES));
    },

    async checkUsernameAvailable(username) {
      const { data, error } = await client.rpc('check_username_available', {
        p_username: username,
      });
      if (error) throw new AuthActionError(resolveErrorCode(error, ONBOARDING_CODES));
      return data === true;
    },

    async completeOnboarding({ username, displayName, locale, discoverableByEmail }) {
      const { error } = await client.rpc('complete_onboarding', {
        p_username: username,
        p_display_name: displayName,
        p_locale: locale,
        p_discoverable_by_email: discoverableByEmail,
      });
      if (error) throw new AuthActionError(resolveErrorCode(error, ONBOARDING_CODES));
    },

    async updateReceiveSettings({ receiveMode, discoverableByUsername, discoverableByEmail }) {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session) throw new AuthActionError('not_authenticated');
      const { error } = await client
        .from('profiles')
        .update({
          receive_mode: receiveMode,
          discoverable_by_username: discoverableByUsername,
          discoverable_by_email: discoverableByEmail,
        })
        .eq('id', session.user.id);
      if (error) throw new AuthActionError<'not_authenticated' | 'unknown'>('unknown');
    },

    async updateAvatar(avatarKey) {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session) throw new AuthActionError('not_authenticated');
      const { error } = await client
        .from('profiles')
        .update({ avatar_key: avatarKey })
        .eq('id', session.user.id);
      if (error) throw new AuthActionError<'not_authenticated' | 'unknown'>('unknown');
    },

    async updatePushOnDelivery(enabled) {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session) throw new AuthActionError('not_authenticated');
      const { error } = await client
        .from('profiles')
        .update({ push_on_delivery: enabled })
        .eq('id', session.user.id);
      if (error) throw new AuthActionError<'not_authenticated' | 'unknown'>('unknown');
    },

    async updateLocale(locale) {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session) throw new AuthActionError('not_authenticated');
      const { error } = await client.from('profiles').update({ locale }).eq('id', session.user.id);
      if (error) throw new AuthActionError<'not_authenticated' | 'unknown'>('unknown');
    },
  };
}

let shared: AuthRepository | null = null;

/** Created on first use, over the shared `getSupabase()` client (same lazy-singleton pattern). */
export function getAuthRepository(): AuthRepository {
  shared ??= createSupabaseAuthRepository(getSupabase());
  return shared;
}
