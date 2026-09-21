import { randomBytes as nodeRandomBytes } from 'crypto';

import { parseSupabaseEnv } from '../src/core/config/env';
import { base64ToBytes } from '../src/core/encoding/base64';
import { createSupabaseClient } from '../src/data/supabase/client';
import {
  BLOB_KEY_PREFIX,
  createEncryptedStorage,
  type BlobStore,
} from '../src/data/supabase/encryptedStorage';

const b64url = (value: object) =>
  Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const jwt = (claims: object) =>
  `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(claims)}.c2lnbmF0dXJl`;

const ENV = parseSupabaseEnv({
  url: 'https://abcdefghijklmnop.supabase.co',
  anonKey: jwt({ role: 'anon' }),
});
// supabase-js keeps the session under sb-<project ref>-auth-token.
const SESSION_KEY = 'sb-abcdefghijklmnop-auth-token';

function memoryBlobStore() {
  const blobs = new Map<string, string>();
  const store: BlobStore = {
    getItem: async (key) => blobs.get(key) ?? null,
    setItem: async (key, value) => {
      blobs.set(key, value);
    },
    removeItem: async (key) => {
      blobs.delete(key);
    },
  };
  return { blobs, store };
}

function encryptedStorageOver(blobStore: BlobStore, keyHolder = { key: null as string | null }) {
  return createEncryptedStorage({
    keyStore: {
      get: async () => keyHolder.key,
      set: async (value) => {
        keyHolder.key = value;
      },
    },
    blobStore,
    randomBytes: (length) => new Uint8Array(nodeRandomBytes(length)),
  });
}

function storedSession() {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: jwt({ sub: 'user-1', role: 'authenticated', exp: now + 3600 }),
    refresh_token: 'refresh-token-value',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    user: {
      id: 'user-1',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'sara@example.test',
      app_metadata: {},
      user_metadata: { name: 'سارة أحمد' },
      created_at: new Date().toISOString(),
    },
  };
}

describe('Supabase client on encrypted storage', () => {
  it('reads a stored session back through the encrypted storage, without any network call', async () => {
    const { blobs, store } = memoryBlobStore();
    const storage = encryptedStorageOver(store);
    const session = storedSession();
    await storage.setItem(SESSION_KEY, JSON.stringify(session));

    const client = createSupabaseClient(ENV, storage, { autoRefreshToken: false });
    const { data, error } = await client.auth.getSession();

    expect(error).toBeNull();
    expect(data.session?.user.id).toBe('user-1');
    expect(data.session?.user.user_metadata).toEqual({ name: 'سارة أحمد' });
    expect(data.session?.refresh_token).toBe('refresh-token-value');

    // At rest there is only ciphertext under our prefix, nothing readable.
    const stored = blobs.get(BLOB_KEY_PREFIX + SESSION_KEY) as string;
    const asText = Buffer.from(base64ToBytes(stored)).toString('latin1');
    expect(asText).not.toContain('refresh-token-value');
    expect(asText).not.toContain('sara@example.test');
    expect(blobs.has(SESSION_KEY)).toBe(false); // never written in plain text
  });

  it('sees no session when the stored data was tampered with', async () => {
    const { blobs, store } = memoryBlobStore();
    const storage = encryptedStorageOver(store);
    await storage.setItem(SESSION_KEY, JSON.stringify(storedSession()));

    const name = BLOB_KEY_PREFIX + SESSION_KEY;
    const bytes = base64ToBytes(blobs.get(name) as string);
    bytes[30] ^= 1;
    blobs.set(name, Buffer.from(bytes).toString('base64'));

    const client = createSupabaseClient(ENV, storage, { autoRefreshToken: false });
    const { data } = await client.auth.getSession();
    expect(data.session).toBeNull();
    expect(blobs.has(name)).toBe(false);
  });

  it('starts signed out when nothing is stored', async () => {
    const { store } = memoryBlobStore();
    const client = createSupabaseClient(ENV, encryptedStorageOver(store), {
      autoRefreshToken: false,
    });
    expect((await client.auth.getSession()).data.session).toBeNull();
  });
});
