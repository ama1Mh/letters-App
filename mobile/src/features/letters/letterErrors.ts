import { LetterActionError, type LetterErrorCode } from '@/data/letters/lettersRepository';
import { knownErrorKey } from '@/core/i18n/errorKey';

/**
 * Letter error codes with their own text under `letters.error.*`. Everything else (including
 * `not_authenticated`, `invalid_input`, network failures and non-LetterActionError throws) shows
 * `letters.error.unknown`. `cannot_send` is deliberately one neutral message: it must not reveal a
 * block or the recipient's receive setting (CLAUDE.md, neutral failure messages).
 */
export const TRANSLATED_LETTER_ERRORS = [
  'recipient_required',
  'body_empty',
  'cannot_send',
  'schedule_in_past',
  'schedule_too_soon',
  'schedule_too_far',
  'rate_limited',
  'already_delivered',
  'not_scheduled',
  'not_found',
] as const satisfies readonly LetterErrorCode[];

export type TranslatedLetterError = (typeof TRANSLATED_LETTER_ERRORS)[number];

/** Use as `t(\`letters.error.${letterErrorKey(e)}\`)`. */
export function letterErrorKey(error: unknown): TranslatedLetterError | 'unknown' {
  if (!(error instanceof LetterActionError)) return 'unknown';
  return knownErrorKey(error.code, TRANSLATED_LETTER_ERRORS);
}
