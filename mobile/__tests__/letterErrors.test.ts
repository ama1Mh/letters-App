import { LetterActionError } from '@/data/letters/lettersRepository';
import { TRANSLATED_LETTER_ERRORS, letterErrorKey } from '@/features/letters/letterErrors';

import ar from '../src/core/i18n/locales/ar.json';
import en from '../src/core/i18n/locales/en.json';

describe('letterErrorKey', () => {
  it.each(TRANSLATED_LETTER_ERRORS)('keeps the translated code %s', (code) => {
    expect(letterErrorKey(new LetterActionError(code))).toBe(code);
  });

  it('falls back to unknown for untranslated codes and foreign errors', () => {
    expect(letterErrorKey(new LetterActionError('not_authenticated'))).toBe('unknown');
    expect(letterErrorKey(new LetterActionError('invalid_input'))).toBe('unknown');
    expect(letterErrorKey(new LetterActionError('unknown'))).toBe('unknown');
    expect(letterErrorKey(new TypeError('Network request failed'))).toBe('unknown');
    expect(letterErrorKey('schedule_too_soon')).toBe('unknown');
  });

  it('has English and Arabic text for every key it can return', () => {
    for (const key of [...TRANSLATED_LETTER_ERRORS, 'unknown'] as const) {
      expect(en.letters.error[key]).toEqual(expect.any(String));
      expect(ar.letters.error[key]).toEqual(expect.any(String));
    }
  });
});
