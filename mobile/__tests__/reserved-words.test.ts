import { RESERVED_BRAND_WORDS, getBrandConfig } from '../brand.config';
import { RESERVED_WORDS, validateUsername } from '../src/domain/username';

describe('reserved words', () => {
  it('include every brand word from brand.config.ts (single source of truth)', () => {
    expect(RESERVED_BRAND_WORDS.length).toBeGreaterThan(0);
    for (const word of RESERVED_BRAND_WORDS) expect(RESERVED_WORDS).toContain(word);
  });

  it('cover the current temporary brand slug', () => {
    expect(RESERVED_BRAND_WORDS).toContain(getBrandConfig('dev').slug);
  });

  it('are lowercase ASCII, so the skeleton comparison is meaningful', () => {
    for (const word of RESERVED_WORDS) expect(word).toMatch(/^[a-z0-9]+$/);
  });

  it('are all rejected as usernames', () => {
    for (const word of RESERVED_WORDS) {
      const result = validateUsername(word);
      // Words shorter than the minimum length fail on length first; none are that short today.
      expect(result).toEqual({ ok: false, code: 'reserved' });
    }
  });
});
