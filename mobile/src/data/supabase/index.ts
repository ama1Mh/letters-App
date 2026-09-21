/**
 * The app-wide Supabase client: the factory wired to the real secure stores.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { readSupabaseEnv } from '../../core/config/env';
import { createSupabaseClient } from './client';
import { createEncryptedStorage } from './encryptedStorage';
import { secureKeyStore, secureRandomBytes, sqliteBlobStore } from './nativeStores';

let shared: SupabaseClient | null = null;

/**
 * Created on first use, so the app still starts (and the shell still renders) when `.env` is not
 * filled in yet. Throws EnvConfigError if the configuration is missing or invalid; callers show
 * that as a setup problem and never include the value.
 */
export function getSupabase(): SupabaseClient {
  shared ??= createSupabaseClient(
    readSupabaseEnv(),
    createEncryptedStorage({
      keyStore: secureKeyStore,
      blobStore: sqliteBlobStore,
      randomBytes: secureRandomBytes,
      // Only the reason is reported, never any data.
      onCorrupt: (reason) => console.warn(`Stored session discarded (${reason}); sign in again.`),
    }),
  );
  return shared;
}
