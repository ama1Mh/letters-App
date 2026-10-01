/**
 * Letter size limits, mirrored from the CHECK constraints in
 * supabase/migrations/20260924120000_letters.sql (`letters_subject_length`, `letters_body_length`);
 * change both together. The server counts code points and TextInput's `maxLength` counts UTF-16
 * units, so the client limit is never looser than the server's.
 */
export const LETTER_SUBJECT_MAX = 120;
export const LETTER_BODY_MAX = 10_000;

/** Show the remaining-characters counter once the body is this full. */
export const LETTER_BODY_COUNTER_FROM = 0.9;

export function shouldShowBodyCounter(length: number): boolean {
  return length >= Math.floor(LETTER_BODY_MAX * LETTER_BODY_COUNTER_FROM);
}
