/**
 * Typed environment configuration. Only two values exist, both public by design (they ship in the
 * app bundle): the Supabase project URL and its anon/publishable key. The real values live in the
 * git-ignored `mobile/.env`; `mobile/.env.example` documents the names.
 *
 * Errors carry the variable name and a code, never the value, so nothing sensitive is logged.
 * A secret (`service_role`) key is refused outright: it must never be inside the app.
 */
import { base64ToBytes } from '../encoding/base64';

export const SUPABASE_URL_VARIABLE = 'EXPO_PUBLIC_SUPABASE_URL';
export const SUPABASE_ANON_KEY_VARIABLE = 'EXPO_PUBLIC_SUPABASE_ANON_KEY';

export type EnvErrorCode =
  'missing' | 'invalid_url' | 'insecure_url' | 'secret_key' | 'invalid_key';

export class EnvConfigError extends Error {
  readonly code: EnvErrorCode;
  readonly variable: string;

  constructor(code: EnvErrorCode, variable: string) {
    super(`${variable}: ${code}`);
    this.name = 'EnvConfigError';
    this.code = code;
    this.variable = variable;
  }
}

export interface SupabaseEnv {
  /** Origin only, no trailing slash. */
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/** Plain http is allowed only for a local stack and the Android emulator's alias for the host. */
const LOCAL_HTTP_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '10.0.2.2'];

function parseUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new EnvConfigError('missing', SUPABASE_URL_VARIABLE);

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new EnvConfigError('invalid_url', SUPABASE_URL_VARIABLE);
  }

  const hasExtras =
    url.username !== '' || url.password !== '' || url.pathname.replace(/\/+$/, '') !== '';
  const isPlaceholder = url.hostname.toLowerCase().startsWith('your-');
  if (hasExtras || isPlaceholder) throw new EnvConfigError('invalid_url', SUPABASE_URL_VARIABLE);

  if (url.protocol === 'https:') return url.origin;
  if (url.protocol === 'http:' && LOCAL_HTTP_HOSTS.includes(url.hostname)) return url.origin;
  throw new EnvConfigError('insecure_url', SUPABASE_URL_VARIABLE);
}

/** The `role` claim of a JWT-shaped key, or null when it is not one. No signature check: this is
 *  only a guard against pasting the wrong key. */
function jwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const bytes = base64ToBytes(parts[1]);
    let json = '';
    for (const byte of bytes) json += String.fromCharCode(byte);
    const role = (JSON.parse(json) as { role?: unknown }).role;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

function parseAnonKey(value: string | undefined): string {
  const key = value?.trim();
  if (!key) throw new EnvConfigError('missing', SUPABASE_ANON_KEY_VARIABLE);

  if (key.startsWith('sb_secret_'))
    throw new EnvConfigError('secret_key', SUPABASE_ANON_KEY_VARIABLE);
  if (key.startsWith('sb_publishable_')) return key;

  const role = jwtRole(key);
  if (role === 'service_role') throw new EnvConfigError('secret_key', SUPABASE_ANON_KEY_VARIABLE);
  if (role === 'anon') return key;
  throw new EnvConfigError('invalid_key', SUPABASE_ANON_KEY_VARIABLE);
}

/** Validates raw values. Pure, so it is unit-tested without touching `process.env`. */
export function parseSupabaseEnv(raw: {
  url: string | undefined;
  anonKey: string | undefined;
}): SupabaseEnv {
  return { supabaseUrl: parseUrl(raw.url), supabaseAnonKey: parseAnonKey(raw.anonKey) };
}

/**
 * Reads the values Expo inlines at bundle time. Expo only replaces `process.env.EXPO_PUBLIC_*`
 * when it is spelled out statically, so do not turn these into dynamic lookups.
 */
export function readSupabaseEnv(): SupabaseEnv {
  return parseSupabaseEnv({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
}
