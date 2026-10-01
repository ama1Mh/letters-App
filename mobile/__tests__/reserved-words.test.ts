import { RESERVED_BRAND_WORDS, getBrandConfig } from '../brand.config';
import { validateDisplayName } from '../src/domain/displayName';
import { RESERVED_WORDS, validateUsername } from '../src/domain/username';

describe('reserved words', () => {
  it('include every brand word from brand.config.ts (single source of truth)', () => {
    expect(RESERVED_BRAND_WORDS.length).toBeGreaterThan(0);
    for (const word of RESERVED_BRAND_WORDS) expect(RESERVED_WORDS).toContain(word);
  });

  it('cover the current temporary brand slug', () => {
    expect(RESERVED_BRAND_WORDS).toContain(getBrandConfig('dev').slug);
  });

  // Same rule as the reserved_words CHECK in SQL: lowercase ASCII (skeleton-compared, usernames and
  // display names) or plain Arabic letters (the Arabic brand name; display names only, since
  // usernames are ASCII).
  it('are lowercase ASCII or plain Arabic letters', () => {
    for (const word of RESERVED_WORDS) expect(word).toMatch(/^([a-z0-9]+|[ء-ي]+)$/);
  });

  it('are all rejected as usernames (ASCII) or display names (Arabic)', () => {
    for (const word of RESERVED_WORDS.filter((w) => !/^[a-z0-9]+$/.test(w))) {
      expect(validateDisplayName(word)).toEqual({ ok: false, code: 'reserved' });
    }
    for (const word of RESERVED_WORDS.filter((w) => /^[a-z0-9]+$/.test(w))) {
      const result = validateUsername(word);
      // Words shorter than the minimum length fail on length first; none are that short today.
      expect(result).toEqual({ ok: false, code: 'reserved' });
    }
  });
});
