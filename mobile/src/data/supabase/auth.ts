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
  /** Onboarding is complete once this is set (mirrors the `profiles_onboarded_complete` check). */
  onboardedAt: string | null;
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
  onboarded_at: string | null;
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
    onboardedAt: row.onboarded_at,
  };
}

function stringProp(value: object, key: string): string | undefined {
  if (!(key in value)) return undefined;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === 'string' ? raw : undefined;
}

/** Reads `error.code` (an Auth error) falling back to `error.message` (an RPC exception message,
 *  which *is* the code), and returns it only if it is one this caller declared it understands. */
function resolveErrorCode<Code extends string>(
  error: unknown,
  knownCodes: readonly Code[],
): Code | 'unknown' {
  const candidate =
    error !== null && typeof error === 'object'
      ? (stringProp(error, 'code') ?? stringProp(error, 'message'))
      : undefined;
  return candidate !== undefined && (knownCodes as readonly string[]).includes(candidate)
    ? (candidate as Code)
    : 'unknown';
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
  'id, username, display_name, avatar_key, locale, receive_mode, discoverable_by_username, discoverable_by_email, read_receipts_enabled, onboarded_at';

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

    async requestPasswordReset(email) {
      // The deep-link target this points at is not implemented yet: consuming the recovery link
      // needs the redirect URL allow-listed in the Supabase dashboard (a cloud config change the
      // owner must make) and a screen to set the new password. See OPEN-10 in DECISIONS.md.
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${currentBrand().scheme}://reset-password`,
      });
      if (error) throw new AuthActionError(resolveErrorCode(error, RESET_PASSWORD_CODES));
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
  };
}

let shared: AuthRepository | null = null;

/** Created on first use, over the shared `getSupabase()` client (same lazy-singleton pattern). */
export function getAuthRepository(): AuthRepository {
  shared ??= createSupabaseAuthRepository(getSupabase());
  return shared;
}
