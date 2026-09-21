import { randomBytes as nodeRandomBytes } from 'crypto';

import { base64ToBytes, bytesToBase64 } from '../src/core/encoding/base64';
import {
  BLOB_KEY_PREFIX,
  createEncryptedStorage,
  ENCRYPTION_KEY_LENGTH,
  FORMAT_VERSION,
  NONCE_LENGTH,
  TAG_LENGTH,
  type BlobStore,
  type CorruptionReason,
  type KeyStore,
} from '../src/data/supabase/encryptedStorage';

const KEY = 'sb-test-auth-token';
const randomBytes = (length: number) => new Uint8Array(nodeRandomBytes(length));
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 1));

/** In-memory stores with a little latency, so overlapping calls really interleave. */
function fakeStores() {
  const blobs = new Map<string, string>();
  const state = { key: null as string | null, keyWrites: 0, failKeyReads: false };

  const keyStore: KeyStore = {
    async get() {
      await tick();
      if (state.failKeyReads) throw new Error('secure store unavailable');
      return state.key;
    },
    async set(value) {
      await tick();
      state.keyWrites++;
      state.key = value;
    },
  };
  const blobStore: BlobStore = {
    async getItem(key) {
      await tick();
      return blobs.get(key) ?? null;
    },
    async setItem(key, value) {
      await tick();
      blobs.set(key, value);
    },
    async removeItem(key) {
      await tick();
      blobs.delete(key);
    },
  };
  return { blobs, state, keyStore, blobStore };
}

function makeStorage(stores = fakeStores()) {
  const corruptions: CorruptionReason[] = [];
  const storage = createEncryptedStorage({
    keyStore: stores.keyStore,
    blobStore: stores.blobStore,
    randomBytes,
    onCorrupt: (reason) => corruptions.push(reason),
  });
  return { ...stores, storage, corruptions };
}

const SESSION = JSON.stringify({
  access_token: 'eyJhbGciOi.payload.signature',
  refresh_token: 'refresh-secret-value',
  user: { id: 'u1', user_metadata: { name: 'سارة أحمد' } },
  padding: 'x'.repeat(5000), // larger than SecureStore's per-value limit on some devices
});

function editBlob(blobs: Map<string, string>, edit: (bytes: Uint8Array) => Uint8Array) {
  const name = BLOB_KEY_PREFIX + KEY;
  blobs.set(name, bytesToBase64(edit(base64ToBytes(blobs.get(name) as string))));
}

describe('encrypted session storage', () => {
  it('round-trips a large session with non-ASCII text', async () => {
    const { storage } = makeStorage();
    await storage.setItem(KEY, SESSION);
    expect(await storage.getItem(KEY)).toBe(SESSION);
  });

  it('returns null when nothing is stored, and creates no key', async () => {
    const { storage, state } = makeStorage();
    expect(await storage.getItem(KEY)).toBeNull();
    expect(state.keyWrites).toBe(0);
    expect(state.key).toBeNull();
  });

  it('stores only ciphertext, in the documented layout', async () => {
    const { storage, blobs } = makeStorage();
    await storage.setItem(KEY, SESSION);

    const stored = blobs.get(BLOB_KEY_PREFIX + KEY) as string;
    expect(stored).not.toContain('refresh-secret-value');
    const bytes = base64ToBytes(stored);
    expect(bytes[0]).toBe(FORMAT_VERSION);
    expect(bytes.length).toBe(
      1 + NONCE_LENGTH + new TextEncoder().encode(SESSION).length + TAG_LENGTH,
    );
    expect(Buffer.from(bytes).toString('latin1')).not.toContain('refresh_token');
  });

  it('keeps a 32-byte key in the key store, not in the blob store', async () => {
    const { storage, state, blobs } = makeStorage();
    await storage.setItem(KEY, SESSION);
    expect(base64ToBytes(state.key as string).length).toBe(ENCRYPTION_KEY_LENGTH);
    for (const value of blobs.values()) expect(value).not.toContain(state.key as string);
  });

  it('uses a fresh nonce for every write', async () => {
    const { storage, blobs } = makeStorage();
    const seen = new Set<string>();
    for (let round = 0; round < 25; round++) {
      await storage.setItem(KEY, SESSION);
      seen.add(
        bytesToBase64(
          base64ToBytes(blobs.get(BLOB_KEY_PREFIX + KEY) as string).subarray(1, 1 + NONCE_LENGTH),
        ),
      );
    }
    expect(seen.size).toBe(25);
  });

  it('overwrites and removes', async () => {
    const { storage } = makeStorage();
    await storage.setItem(KEY, 'first');
    await storage.setItem(KEY, 'second');
    expect(await storage.getItem(KEY)).toBe('second');
    await storage.removeItem(KEY);
    expect(await storage.getItem(KEY)).toBeNull();
  });

  it('keeps entries under different keys apart', async () => {
    const { storage } = makeStorage();
    await storage.setItem('a', 'value-a');
    await storage.setItem('b', 'value-b');
    await storage.removeItem('a');
    expect(await storage.getItem('a')).toBeNull();
    expect(await storage.getItem('b')).toBe('value-b');
  });

  it('survives an app restart (a new instance over the same stores)', async () => {
    const first = makeStorage();
    await first.storage.setItem(KEY, SESSION);
    const second = makeStorage({
      blobs: first.blobs,
      state: first.state,
      keyStore: first.keyStore,
      blobStore: first.blobStore,
    });
    expect(await second.storage.getItem(KEY)).toBe(SESSION);
  });

  describe('tampered data', () => {
    it.each([
      [
        'a flipped ciphertext byte',
        (b: Uint8Array) => Uint8Array.from(b, (v, i) => (i === 20 ? v ^ 1 : v)),
      ],
      [
        'a flipped tag byte',
        (b: Uint8Array) => Uint8Array.from(b, (v, i) => (i === b.length - 1 ? v ^ 1 : v)),
      ],
      [
        'a flipped nonce byte',
        (b: Uint8Array) => Uint8Array.from(b, (v, i) => (i === 3 ? v ^ 1 : v)),
      ],
      ['appended bytes', (b: Uint8Array) => Uint8Array.from([...b, 0])],
      ['a shortened ciphertext', (b: Uint8Array) => b.slice(0, b.length - 1)],
    ])('rejects %s, discards it, and reports decrypt_failed', async (_label, edit) => {
      const { storage, blobs, corruptions } = makeStorage();
      await storage.setItem(KEY, SESSION);
      editBlob(blobs, edit);

      expect(await storage.getItem(KEY)).toBeNull();
      expect(blobs.has(BLOB_KEY_PREFIX + KEY)).toBe(false);
      expect(corruptions).toEqual(['decrypt_failed']);
    });

    it.each([
      [
        'an unknown format version',
        (b: Uint8Array) => Uint8Array.from(b, (v, i) => (i === 0 ? 9 : v)),
      ],
      [
        'a blob too short to hold a nonce and tag',
        () => Uint8Array.from([FORMAT_VERSION, 1, 2, 3]),
      ],
      ['an empty blob', () => new Uint8Array(0)],
    ])('rejects %s as invalid_format', async (_label, edit) => {
      const { storage, blobs, corruptions } = makeStorage();
      await storage.setItem(KEY, SESSION);
      editBlob(blobs, edit);

      expect(await storage.getItem(KEY)).toBeNull();
      expect(corruptions).toEqual(['invalid_format']);
    });

    it('rejects text that is not base64 as invalid_format', async () => {
      const { storage, blobs, corruptions } = makeStorage();
      await storage.setItem(KEY, SESSION);
      blobs.set(BLOB_KEY_PREFIX + KEY, '{"access_token":"plaintext, not ciphertext"}');

      expect(await storage.getItem(KEY)).toBeNull();
      expect(corruptions).toEqual(['invalid_format']);
    });

    it('does not accept a blob copied to a different storage key', async () => {
      const { storage, blobs, corruptions } = makeStorage();
      await storage.setItem('key-a', SESSION);
      blobs.set(BLOB_KEY_PREFIX + 'key-b', blobs.get(BLOB_KEY_PREFIX + 'key-a') as string);

      expect(await storage.getItem('key-b')).toBeNull();
      expect(corruptions).toEqual(['decrypt_failed']);
      expect(await storage.getItem('key-a')).toBe(SESSION); // the original is untouched
    });
  });

  describe('encryption key problems', () => {
    it('treats a missing key as unrecoverable: returns null, discards the data, reports key_missing', async () => {
      const first = makeStorage();
      await first.storage.setItem(KEY, SESSION);
      first.state.key = null; // e.g. the secure store was cleared or restored on another device

      const restarted = makeStorage({
        blobs: first.blobs,
        state: first.state,
        keyStore: first.keyStore,
        blobStore: first.blobStore,
      });
      expect(await restarted.storage.getItem(KEY)).toBeNull();
      expect(first.blobs.has(BLOB_KEY_PREFIX + KEY)).toBe(false);
      expect(restarted.corruptions).toEqual(['key_missing']);
    });

    it('never returns data decrypted with a different key', async () => {
      const first = makeStorage();
      await first.storage.setItem(KEY, SESSION);
      first.state.key = bytesToBase64(randomBytes(ENCRYPTION_KEY_LENGTH));

      const restarted = makeStorage({
        blobs: first.blobs,
        state: first.state,
        keyStore: first.keyStore,
        blobStore: first.blobStore,
      });
      expect(await restarted.storage.getItem(KEY)).toBeNull();
      expect(restarted.corruptions).toEqual(['decrypt_failed']);
    });

    it.each(['not base64 !!', bytesToBase64(new Uint8Array(16))])(
      'treats a malformed stored key (%s) as missing on read, and replaces it on write',
      async (badKey) => {
        const stores = fakeStores();
        stores.state.key = badKey;
        const { storage, corruptions } = makeStorage(stores);

        await storage.setItem(KEY, 'fresh'); // creates a proper key over the bad one
        expect(base64ToBytes(stores.state.key as string).length).toBe(ENCRYPTION_KEY_LENGTH);
        expect(await storage.getItem(KEY)).toBe('fresh');
        expect(corruptions).toEqual([]);
      },
    );

    it('creates the key once when writes overlap, and every value stays readable', async () => {
      const first = makeStorage();
      await Promise.all(
        ['a', 'b', 'c', 'd', 'e'].map((name) => first.storage.setItem(name, `value-${name}`)),
      );
      expect(first.state.keyWrites).toBe(1);

      const restarted = makeStorage({
        blobs: first.blobs,
        state: first.state,
        keyStore: first.keyStore,
        blobStore: first.blobStore,
      });
      for (const name of ['a', 'b', 'c', 'd', 'e']) {
        expect(await restarted.storage.getItem(name)).toBe(`value-${name}`);
      }
    });

    it('keeps the data when the key store is temporarily unavailable', async () => {
      const { storage, blobs, state, corruptions } = makeStorage();
      await storage.setItem(KEY, SESSION);

      state.failKeyReads = true;
      await expect(storage.getItem(KEY)).rejects.toThrow('secure store unavailable');
      expect(blobs.has(BLOB_KEY_PREFIX + KEY)).toBe(true); // not wiped by a transient error
      expect(corruptions).toEqual([]);

      state.failKeyReads = false;
      expect(await storage.getItem(KEY)).toBe(SESSION);
    });
  });
});
