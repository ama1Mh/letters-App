/**
 * Display-name rules (DEC-010). Pure TypeScript: no React, no Supabase. The database enforces the
 * same rules (Phase 2), so any change here needs a matching migration.
 */
import { isReservedWord } from './username';

export const DISPLAY_NAME_MIN_LENGTH = 1;
export const DISPLAY_NAME_MAX_LENGTH = 50;

export type DisplayNameErrorCode =
  'empty' | 'too_long' | 'no_letter_or_digit' | 'contains_at' | 'contains_url' | 'reserved';

export type DisplayNameResult =
  { ok: true; displayName: string } | { ok: false; code: DisplayNameErrorCode };

/**
 * `@` look-alikes: fullwidth commercial at and small commercial at. Built from code points so the
 * source stays readable.
 */
const AT_SIGNS = ['@', String.fromCodePoint(0xff20), String.fromCodePoint(0xfe6b)];

const URL_LIKE =
  /:\/\/|(^|[^\p{L}\p{N}])www\.|[\p{L}\p{N}-]\.(com|net|org|io|app|me|co|ly|link|xyz|info|biz|dev|ai|gg|tv|ws|cc)(?![\p{L}\p{N}])/iu;

/**
 * Cleans a display name: NFC, format characters removed, whitespace collapsed to single spaces,
 * control characters removed, trimmed. `\p{Cf}` covers the zero-width and bidi
 * override/embedding/isolate characters DEC-010 lists (U+200B-U+200F, U+202A-U+202E,
 * U+2066-U+2069, U+FEFF) and a few more that serve no purpose in a name; `\p{Cc}` covers control
 * characters.
 *
 * The order matters. Format characters go first because U+FEFF also counts as whitespace in
 * JavaScript, so collapsing whitespace first would turn a hidden BOM into a visible space. Control
 * characters go after the collapse so that tabs and newlines become spaces instead of gluing words.
 */
export function sanitizeDisplayName(input: string): string {
  return input
    .normalize('NFC')
    .replace(/\p{Cf}/gu, '')
    .replace(/\s+/gu, ' ')
    .replace(/\p{Cc}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Length in characters as the user sees them (code points), matching Postgres `char_length`. */
function characterCount(value: string): number {
  return Array.from(value).length;
}

export function validateDisplayName(input: string): DisplayNameResult {
  const displayName = sanitizeDisplayName(input);

  if (characterCount(displayName) < DISPLAY_NAME_MIN_LENGTH) return { ok: false, code: 'empty' };
  if (characterCount(displayName) > DISPLAY_NAME_MAX_LENGTH) return { ok: false, code: 'too_long' };
  if (!/[\p{L}\p{N}]/u.test(displayName)) return { ok: false, code: 'no_letter_or_digit' };
  if (AT_SIGNS.some((sign) => displayName.includes(sign)))
    return { ok: false, code: 'contains_at' };
  if (URL_LIKE.test(displayName)) return { ok: false, code: 'contains_url' };
  if (isReservedWord(displayName.replace(/\s+/gu, ''))) return { ok: false, code: 'reserved' };

  return { ok: true, displayName };
}
