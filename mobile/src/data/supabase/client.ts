/**
 * The Supabase client. Only the anon/publishable key is ever used in the app: the env loader
 * refuses a service_role key, and no code path here accepts another credential. The session is
 * persisted through the storage it is given (the encrypted one in the app), never in plain text.
 *
 * This file has no native imports so tests can use it; the app-wide instance is in ./index.ts.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { SupabaseEnv } from '../../core/config/env';
import type { BlobStore } from './encryptedStorage';

export interface SupabaseClientOptions {
  /** Tests turn this off so no refresh timer keeps running. The app leaves it on. */
  autoRefreshToken?: boolean;
}

/** Builds a client that keeps the session in `storage`. Pure of native modules, so it is testable. */
export function createSupabaseClient(
  env: SupabaseEnv,
  storage: BlobStore,
  options: SupabaseClientOptions = {},
): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: options.autoRefreshToken ?? true,
      // Deep links are handled by Expo Router, not by reading the URL inside the client.
      detectSessionInUrl: false,
    },
  });
}
