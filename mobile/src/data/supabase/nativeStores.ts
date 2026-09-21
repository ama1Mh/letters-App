/**
 * The real stores behind createEncryptedStorage: expo-secure-store for the AES key, expo-sqlite's
 * kv-store for the ciphertext, expo-crypto for randomness. Thin on purpose (no logic to test);
 * these are native modules, so they need a development build that includes them.
 */
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';

import type { BlobStore, KeyStore, RandomBytes } from './encryptedStorage';

/** Bump the suffix to rotate the key format; old ciphertext is then discarded, not misread. */
const ENCRYPTION_KEY_NAME = 'session-encryption-key-v1';

// Readable after the first unlock so a background token refresh works, never synced or backed up.
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const secureKeyStore: KeyStore = {
  get: () => SecureStore.getItemAsync(ENCRYPTION_KEY_NAME, SECURE_OPTIONS),
  set: (value) => SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, value, SECURE_OPTIONS),
};

export const sqliteBlobStore: BlobStore = {
  getItem: (key) => Storage.getItem(key),
  setItem: (key, value) => Storage.setItem(key, value),
  removeItem: async (key) => {
    await Storage.removeItem(key);
  },
};

export const secureRandomBytes: RandomBytes = (length) => getRandomBytes(length);
