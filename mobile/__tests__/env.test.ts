import {
  EnvConfigError,
  parseSupabaseEnv,
  SUPABASE_ANON_KEY_VARIABLE,
  SUPABASE_URL_VARIABLE,
  type EnvErrorCode,
} from '../src/core/config/env';

const b64url = (value: object) =>
  Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** A JWT-shaped key. The signature is fake: the app only inspects the role claim. */
const jwt = (role: string) =>
  `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ role, iss: 'supabase' })}.c2lnbmF0dXJl`;

const URL_OK = 'https://abcdefghijklmnop.supabase.co';
const ANON = jwt('anon');

function failure(raw: { url: string | undefined; anonKey: string | undefined }) {
  try {
    parseSupabaseEnv(raw);
  } catch (error) {
    if (error instanceof EnvConfigError) return error;
    throw error;
  }
  throw new Error('expected parseSupabaseEnv to throw');
}

function codeOf(raw: { url: string | undefined; anonKey: string | undefined }): EnvErrorCode {
  return failure(raw).code;
}

describe('parseSupabaseEnv', () => {
  it('accepts a hosted URL with a JWT anon key', () => {
    expect(parseSupabaseEnv({ url: URL_OK, anonKey: ANON })).toEqual({
      supabaseUrl: URL_OK,
      supabaseAnonKey: ANON,
    });
  });

  it('accepts a publishable key', () => {
    const key = 'sb_publishable_abc123';
    expect(parseSupabaseEnv({ url: URL_OK, anonKey: key }).supabaseAnonKey).toBe(key);
  });

  it('trims whitespace and a trailing slash', () => {
    expect(parseSupabaseEnv({ url: `  ${URL_OK}/ `, anonKey: ` ${ANON} ` })).toEqual({
      supabaseUrl: URL_OK,
      supabaseAnonKey: ANON,
    });
  });

  it.each(['http://localhost:54321', 'http://127.0.0.1:54321', 'http://10.0.2.2:54321'])(
    'allows plain http only for local hosts: %s',
    (url) => {
      expect(parseSupabaseEnv({ url, anonKey: ANON }).supabaseUrl).toBe(url);
    },
  );

  it.each([undefined, '', '   '])('reports a missing URL: %j', (url) => {
    expect(failure({ url, anonKey: ANON })).toMatchObject({
      code: 'missing',
      variable: SUPABASE_URL_VARIABLE,
    });
  });

  it.each([undefined, '', '   '])('reports a missing key: %j', (anonKey) => {
    expect(failure({ url: URL_OK, anonKey })).toMatchObject({
      code: 'missing',
      variable: SUPABASE_ANON_KEY_VARIABLE,
    });
  });

  it.each([
    'not a url',
    'supabase.co',
    'https://user:pass@abc.supabase.co',
    'https://abc.supabase.co/rest/v1',
  ])('rejects a malformed URL: %s', (url) => {
    expect(codeOf({ url, anonKey: ANON })).toBe('invalid_url');
  });

  it('rejects the placeholder from .env.example', () => {
    expect(codeOf({ url: 'https://YOUR-PROJECT-REF.supabase.co', anonKey: ANON })).toBe(
      'invalid_url',
    );
    expect(codeOf({ url: URL_OK, anonKey: 'YOUR-ANON-OR-PUBLISHABLE-KEY' })).toBe('invalid_key');
  });

  it.each(['http://abc.supabase.co', 'http://192.168.1.10:54321', 'ftp://abc.supabase.co'])(
    'rejects an insecure or non-web URL: %s',
    (url) => {
      expect(codeOf({ url, anonKey: ANON })).toBe('insecure_url');
    },
  );

  it('refuses a service_role key, in either key format', () => {
    expect(codeOf({ url: URL_OK, anonKey: jwt('service_role') })).toBe('secret_key');
    expect(codeOf({ url: URL_OK, anonKey: 'sb_secret_abc123' })).toBe('secret_key');
  });

  it.each([jwt('authenticated'), 'a.b.c', 'plainly-not-a-key', 'eyJhbGciOi.notbase64!.sig'])(
    'rejects a key that is not an anon or publishable key: %s',
    (anonKey) => {
      expect(codeOf({ url: URL_OK, anonKey })).toBe('invalid_key');
    },
  );

  it('never includes the value in the error', () => {
    const secret = jwt('service_role');
    const error = failure({ url: URL_OK, anonKey: secret });
    expect(error.message).not.toContain(secret);
    expect(error.message).toBe(`${SUPABASE_ANON_KEY_VARIABLE}: secret_key`);

    const badUrl = 'http://evil.example/secret-path';
    expect(failure({ url: badUrl, anonKey: ANON }).message).not.toContain('secret-path');
  });

  it('reports the URL problem before the key problem', () => {
    expect(failure({ url: 'nope', anonKey: 'nope' }).variable).toBe(SUPABASE_URL_VARIABLE);
  });
});
