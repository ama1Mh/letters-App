/**
 * Encrypted storage for the Supabase auth session (PLAN §3.1).
 *
 * The session JSON is too big for SecureStore on some devices, so: a random AES-256 key lives in
 * the secure store, and the session is encrypted with AES-256-GCM and kept as ciphertext in a
 * general key-value store (expo-sqlite). GCM is authenticated, so any change to the stored data,
 * a wrong key, or data moved to another storage key is detected and never returned as a session.
 *
 * Stored blob (base64): [format version: 1 byte] [nonce: 12 bytes] [ciphertext + 16-byte tag].
 * The storage key is bound in as associated data. Nothing here ever logs keys or values.
 *
 * The stores are injected so the logic is unit-tested without native modules; the real ones are
 * in nativeStores.ts.
 */
import { gcm } from '@noble/ciphers/aes.js';

import { base64ToBytes, bytesToBase64 } from '../../core/encoding/base64';
import { decodeUtf8, encodeUtf8 } from '../../core/encoding/utf8';

/** Holds the one encryption key, base64-encoded. */
export interface KeyStore {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
}

/** Holds the ciphertext. Same shape as AsyncStorage / expo-sqlite's kv-store. */
export interface BlobStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Cryptographically secure random bytes (expo-crypto in the app). */
export type RandomBytes = (length: number) => Uint8Array;

/** What a stored session turned out to be when it could not be used. */
export type CorruptionReason = 'key_missing' | 'invalid_format' | 'decrypt_failed';

export type EncryptedStorage = BlobStore;

export interface EncryptedStorageOptions {
  keyStore: KeyStore;
  blobStore: BlobStore;
  randomBytes: RandomBytes;
  /** Called (with a reason only, never data) when a stored value is discarded. */
  onCorrupt?: (reason: CorruptionReason) => void;
}

export const ENCRYPTION_KEY_LENGTH = 32;
export const NONCE_LENGTH = 12;
export const TAG_LENGTH = 16;
export const FORMAT_VERSION = 1;
/** Namespaces our blobs inside the shared kv-store (which also holds the language preference). */
export const BLOB_KEY_PREFIX = 'supabase-auth:';

export function createEncryptedStorage(options: EncryptedStorageOptions): EncryptedStorage {
  const { keyStore, blobStore, randomBytes, onCorrupt } = options;

  /** The stored key, or null when absent or malformed. Errors from the store propagate. */
  async function loadKey(): Promise<Uint8Array | null> {
    const stored = await keyStore.get();
    if (stored === null) return null;
    try {
      const key = base64ToBytes(stored);
      return key.length === ENCRYPTION_KEY_LENGTH ? key : null;
    } catch {
      return null;
    }
  }

  // Creating the key must happen once even when writes overlap, or a second key would overwrite
  // the first and make the first write unreadable.
  let creating: Promise<Uint8Array> | null = null;

  async function createKey(): Promise<Uint8Array> {
    const existing = await loadKey(); // another write may have finished creating it meanwhile
    if (existing) return existing;
    const key = randomBytes(ENCRYPTION_KEY_LENGTH);
    await keyStore.set(bytesToBase64(key));
    return key;
  }

  async function keyForWrite(): Promise<Uint8Array> {
    const existing = await loadKey();
    if (existing) return existing;
    creating ??= createKey().finally(() => {
      creating = null;
    });
    return creating;
  }

  async function discard(storageKey: string, reason: CorruptionReason): Promise<null> {
    await blobStore.removeItem(BLOB_KEY_PREFIX + storageKey);
    onCorrupt?.(reason);
    return null;
  }

  return {
    async getItem(storageKey) {
      const stored = await blobStore.getItem(BLOB_KEY_PREFIX + storageKey);
      if (stored === null) return null;

      // A failing key store (for example a locked device) is transient: rethrow and keep the
      // blob. Only a key that is really absent means the data can never be read again.
      const key = await loadKey();
      if (key === null) return discard(storageKey, 'key_missing');

      let blob: Uint8Array;
      try {
        blob = base64ToBytes(stored);
      } catch {
        return discard(storageKey, 'invalid_format');
      }
      if (blob.length < 1 + NONCE_LENGTH + TAG_LENGTH || blob[0] !== FORMAT_VERSION) {
        return discard(storageKey, 'invalid_format');
      }

      try {
        const nonce = blob.subarray(1, 1 + NONCE_LENGTH);
        const sealed = blob.subarray(1 + NONCE_LENGTH);
        const plain = gcm(key, nonce, encodeUtf8(storageKey)).decrypt(sealed);
        return decodeUtf8(plain);
      } catch {
        return discard(storageKey, 'decrypt_failed');
      }
    },

    async setItem(storageKey, value) {
      const key = await keyForWrite();
      const nonce = randomBytes(NONCE_LENGTH); // fresh for every write: never reuse with a key
      const sealed = gcm(key, nonce, encodeUtf8(storageKey)).encrypt(encodeUtf8(value));

      const blob = new Uint8Array(1 + NONCE_LENGTH + sealed.length);
      blob[0] = FORMAT_VERSION;
      blob.set(nonce, 1);
      blob.set(sealed, 1 + NONCE_LENGTH);
      await blobStore.setItem(BLOB_KEY_PREFIX + storageKey, bytesToBase64(blob));
    },

    async removeItem(storageKey) {
      await blobStore.removeItem(BLOB_KEY_PREFIX + storageKey);
    },
  };
}
