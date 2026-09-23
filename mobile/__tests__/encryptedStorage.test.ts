import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes as nodeRandomBytes } from 'crypto';

import { base64ToBytes, bytesToBase64 } from '../src/core/encoding/base64';
import { encodeUtf8 } from '../src/core/encoding/utf8';
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

  describe('associated data', () => {
    /** Seals `value` by hand into a blob: [version][nonce][ciphertext+tag], with chosen AAD. */
    function sealByHand(opts: {
      keyBase64: string;
      headerVersion: number;
      aad: Uint8Array;
      value: string;
    }) {
      const nonce = randomBytes(NONCE_LENGTH);
      const sealed = gcm(base64ToBytes(opts.keyBase64), nonce, opts.aad).encrypt(
        encodeUtf8(opts.value),
      );
      const blob = new Uint8Array(1 + NONCE_LENGTH + sealed.length);
      blob[0] = opts.headerVersion;
      blob.set(nonce, 1);
      blob.set(sealed, 1 + NONCE_LENGTH);
      return bytesToBase64(blob);
    }
    const aadOf = (version: number, storageKey: string) =>
      Uint8Array.from([version, ...encodeUtf8(storageKey)]);

    async function storedKey() {
      const stores = makeStorage();
      await stores.storage.setItem('seed', 'seed'); // creates the encryption key
      return { ...stores, keyBase64: stores.state.key as string };
    }

    it('accepts a blob sealed with the documented associated data (version byte + storage key)', async () => {
      const { storage, blobs, keyBase64, corruptions } = await storedKey();
      blobs.set(
        BLOB_KEY_PREFIX + KEY,
        sealByHand({
          keyBase64,
          headerVersion: FORMAT_VERSION,
          aad: aadOf(FORMAT_VERSION, KEY),
          value: 'by-hand',
        }),
      );
      expect(await storage.getItem(KEY)).toBe('by-hand');
      expect(corruptions).toEqual([]);
    });

    it('rejects a blob whose associated data lacks the version byte (storage key only)', async () => {
      const { storage, blobs, keyBase64, corruptions } = await storedKey();
      blobs.set(
        BLOB_KEY_PREFIX + KEY,
        sealByHand({
          keyBase64,
          headerVersion: FORMAT_VERSION,
          aad: encodeUtf8(KEY),
          value: 'legacy',
        }),
      );
      expect(await storage.getItem(KEY)).toBeNull();
      expect(corruptions).toEqual(['decrypt_failed']);
    });

    it('authenticates the version byte: a blob sealed for another version fails even with the accepted header', async () => {
      const { storage, blobs, keyBase64, corruptions } = await storedKey();
      // A valid GCM seal, but over version 2; only the header byte says 1.
      blobs.set(
        BLOB_KEY_PREFIX + KEY,
        sealByHand({
          keyBase64,
          headerVersion: FORMAT_VERSION,
          aad: aadOf(FORMAT_VERSION + 1, KEY),
          value: 'other-version',
        }),
      );
      expect(await storage.getItem(KEY)).toBeNull();
      expect(corruptions).toEqual(['decrypt_failed']);
    });

    it('still binds the storage key', async () => {
      const { storage, blobs, keyBase64, corruptions } = await storedKey();
      blobs.set(
        BLOB_KEY_PREFIX + KEY,
        sealByHand({
          keyBase64,
          headerVersion: FORMAT_VERSION,
          aad: aadOf(FORMAT_VERSION, 'some-other-key'),
          value: 'wrong-key-binding',
        }),
      );
      expect(await storage.getItem(KEY)).toBeNull();
      expect(corruptions).toEqual(['decrypt_failed']);
    });
  });

  describe('discarding invalid data', () => {
    const NAME = BLOB_KEY_PREFIX + KEY;

    /** Simulates a write that lands right after `getItem` read the blob: on the first read of the
     *  blob, hands back what was there and then replaces it with `newer`. */
    function writeAfterFirstRead(blobs: Map<string, string>, blobStore: BlobStore, newer: string) {
      const realGet = blobStore.getItem.bind(blobStore);
      let reads = 0;
      blobStore.getItem = async (key) => {
        const value = await realGet(key);
        if (key === NAME && ++reads === 1) blobs.set(NAME, newer);
        return value;
      };
    }

    async function validBlobFor(value: string) {
      const other = makeStorage();
      await other.storage.setItem(KEY, value);
      return { blob: other.blobs.get(NAME) as string, key: other.state.key as string };
    }

    it('keeps a newer value written while a tampered one was being rejected', async () => {
      const { storage, blobs, blobStore, state, corruptions } = makeStorage();
      await storage.setItem(KEY, SESSION);
      const { blob: newer, key } = await validBlobFor('newer session');
      state.key = key; // same key, so the newer blob is readable
      editBlob(blobs, (b) => Uint8Array.from(b, (v, i) => (i === 20 ? v ^ 1 : v)));
      writeAfterFirstRead(blobs, blobStore, newer);

      expect(await storage.getItem(KEY)).toBeNull(); // the value that was read was invalid
      expect(corruptions).toEqual(['decrypt_failed']); // and is still reported as such
      expect(blobs.get(NAME)).toBe(newer); // but the newer blob was not deleted
      expect(await storage.getItem(KEY)).toBe('newer session');
    });

    it('keeps a newer value written while a missing key was being handled', async () => {
      const { storage, blobs, blobStore, state, corruptions } = makeStorage();
      await storage.setItem(KEY, SESSION);
      const { blob: newer } = await validBlobFor('newer session');
      state.key = null;
      writeAfterFirstRead(blobs, blobStore, newer);

      expect(await storage.getItem(KEY)).toBeNull();
      expect(corruptions).toEqual(['key_missing']);
      expect(blobs.get(NAME)).toBe(newer);
    });

    it('keeps a newer value written while non-base64 text was being rejected', async () => {
      const { storage, blobs, blobStore, corruptions } = makeStorage();
      await storage.setItem(KEY, SESSION);
      blobs.set(NAME, 'not base64 !!');
      writeAfterFirstRead(blobs, blobStore, 'newer');

      expect(await storage.getItem(KEY)).toBeNull();
      expect(corruptions).toEqual(['invalid_format']);
      expect(blobs.get(NAME)).toBe('newer');
    });

    it('still deletes the invalid blob when nothing changed', async () => {
      const { storage, blobs } = makeStorage();
      await storage.setItem(KEY, SESSION);
      editBlob(blobs, (b) => Uint8Array.from(b, (v, i) => (i === 20 ? v ^ 1 : v)));
      expect(await storage.getItem(KEY)).toBeNull();
      expect(blobs.has(NAME)).toBe(false);
    });

    it('reports the original reason and returns null when deleting the invalid blob fails', async () => {
      const { storage, blobs, blobStore, corruptions } = makeStorage();
      await storage.setItem(KEY, SESSION);
      editBlob(blobs, (b) => Uint8Array.from(b, (v, i) => (i === 20 ? v ^ 1 : v)));
      blobStore.removeItem = async () => {
        throw new Error('disk full');
      };

      expect(await storage.getItem(KEY)).toBeNull();
      expect(corruptions).toEqual(['decrypt_failed']);
      expect(blobs.has(NAME)).toBe(true); // left in place; the next read rejects it again
    });

    it('reports the original reason, and deletes nothing, when re-reading the blob fails', async () => {
      const { storage, blobs, blobStore, corruptions } = makeStorage();
      await storage.setItem(KEY, SESSION);
      editBlob(blobs, (b) => Uint8Array.from(b, (v, i) => (i === 20 ? v ^ 1 : v)));
      const realGet = blobStore.getItem.bind(blobStore);
      let reads = 0;
      blobStore.getItem = async (key) => {
        if (++reads > 1) throw new Error('database locked');
        return realGet(key);
      };

      expect(await storage.getItem(KEY)).toBeNull();
      expect(corruptions).toEqual(['decrypt_failed']);
      expect(blobs.has(NAME)).toBe(true);
    });

    it('does not swallow storage errors on the first read, on writes, or on removes', async () => {
      const { storage, blobStore } = makeStorage();
      await storage.setItem(KEY, SESSION);

      const realGet = blobStore.getItem;
      blobStore.getItem = async () => {
        throw new Error('read failed');
      };
      await expect(storage.getItem(KEY)).rejects.toThrow('read failed');
      blobStore.getItem = realGet;

      blobStore.setItem = async () => {
        throw new Error('write failed');
      };
      await expect(storage.setItem(KEY, 'x')).rejects.toThrow('write failed');

      blobStore.removeItem = async () => {
        throw new Error('remove failed');
      };
      await expect(storage.removeItem(KEY)).rejects.toThrow('remove failed');
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
