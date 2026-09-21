/**
 * Username rules (DEC-010). Pure TypeScript: no React, no Supabase. The database enforces the same
 * rules (Phase 2, supabase/migrations), so any change here needs a matching migration.
 */
import { RESERVED_BRAND_WORDS } from '../../brand.config';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

export type UsernameErrorCode =
  | 'invalid_characters'
  | 'must_start_with_letter'
  | 'trailing_underscore'
  | 'consecutive_underscores'
  | 'too_short'
  | 'too_long'
  | 'reserved';

export type UsernameResult =
  { ok: true; username: string; skeleton: string } | { ok: false; code: UsernameErrorCode };

/** Words nobody may register, checked on the skeleton so look-alikes are blocked too. */
export const RESERVED_WORDS: readonly string[] = [
  'admin',
  'administrator',
  'support',
  'help',
  'staff',
  'moderator',
  'official',
  'system',
  'security',
  'root',
  'null',
  'undefined',
  'api',
  'www',
  ...RESERVED_BRAND_WORDS,
];

/** Stored form: trimmed and lowercase. Uniqueness is case-insensitive. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

const LOOK_ALIKE: Record<string, string> = { '0': 'o', '1': 'l', i: 'l', '5': 's' };

/**
 * Canonical look-alike form (DEC-010). The order is part of the contract and must be identical
 * in SQL: drop `_`, then `rn` -> `m`, then `vv` -> `w`, then 0->o, 1->l, i->l, 5->s. Each step is a
 * single left-to-right, non-overlapping pass. Two usernames with the same skeleton cannot coexist.
 */
export function usernameSkeleton(username: string): string {
  return username
    .toLowerCase()
    .replace(/_/g, '')
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w')
    .replace(/[01i5]/g, (char) => LOOK_ALIKE[char]);
}

const RESERVED_SKELETONS: ReadonlySet<string> = new Set(RESERVED_WORDS.map(usernameSkeleton));

/** True when the value, or any look-alike of it, is a reserved word. */
export function isReservedWord(value: string): boolean {
  return RESERVED_SKELETONS.has(usernameSkeleton(value));
}

/**
 * Validates a username as typed. Checks run in this order, so the first failing rule is the one
 * reported: characters, first character, underscores, length, reserved words.
 */
export function validateUsername(input: string): UsernameResult {
  const username = normalizeUsername(input);

  if (!/^[a-z0-9_]*$/.test(username)) return { ok: false, code: 'invalid_characters' };
  if (username.length > 0 && !/^[a-z]/.test(username)) {
    return { ok: false, code: 'must_start_with_letter' };
  }
  if (username.endsWith('_')) return { ok: false, code: 'trailing_underscore' };
  if (username.includes('__')) return { ok: false, code: 'consecutive_underscores' };
  if (username.length < USERNAME_MIN_LENGTH) return { ok: false, code: 'too_short' };
  if (username.length > USERNAME_MAX_LENGTH) return { ok: false, code: 'too_long' };
  if (isReservedWord(username)) return { ok: false, code: 'reserved' };

  return { ok: true, username, skeleton: usernameSkeleton(username) };
}
