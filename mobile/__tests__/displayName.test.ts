import {
  DISPLAY_NAME_MAX_LENGTH,
  sanitizeDisplayName,
  validateDisplayName,
  type DisplayNameErrorCode,
} from '../src/domain/displayName';

const chars = (...codePoints: number[]) => String.fromCodePoint(...codePoints);

function codeOf(input: string): DisplayNameErrorCode | 'ok' {
  const result = validateDisplayName(input);
  return result.ok ? 'ok' : result.code;
}

/** Every code point DEC-010 lists as stripped: zero-width, bidi marks, overrides, isolates, BOM. */
function listedForbiddenCodePoints(): number[] {
  const ranges: [number, number][] = [
    [0x200b, 0x200f],
    [0x202a, 0x202e],
    [0x2066, 0x2069],
    [0xfeff, 0xfeff],
  ];
  return ranges.flatMap(([from, to]) =>
    Array.from({ length: to - from + 1 }, (_, offset) => from + offset),
  );
}

describe('sanitizeDisplayName', () => {
  it('removes every zero-width and bidi control character DEC-010 lists', () => {
    for (const codePoint of listedForbiddenCodePoints()) {
      expect(sanitizeDisplayName(`Sa${chars(codePoint)}ra`)).toBe('Sara');
    }
  });

  it('removes control characters but keeps words apart', () => {
    expect(sanitizeDisplayName(`a${chars(0x00)}b`)).toBe('ab');
    expect(sanitizeDisplayName(`a${chars(0x7f)}b`)).toBe('ab');
    expect(sanitizeDisplayName('a\nb\tc')).toBe('a b c');
  });

  it('collapses whitespace, including non-breaking and ideographic spaces, and trims', () => {
    expect(sanitizeDisplayName(`  Sara ${chars(0xa0)}${chars(0x3000)}  Ali  `)).toBe('Sara Ali');
  });

  it('does not leave a double space where a zero-width character sat between spaces', () => {
    expect(sanitizeDisplayName(`Sara ${chars(0x200b)} Ali`)).toBe('Sara Ali');
  });

  it('normalizes to NFC', () => {
    const decomposed = `Jose${chars(0x0301)}`; // e + combining acute
    expect(sanitizeDisplayName(decomposed)).toBe(`Jos${chars(0x00e9)}`);
  });

  it('keeps Arabic text and shaping-relevant letters intact', () => {
    expect(sanitizeDisplayName('  سارة   أحمد ')).toBe('سارة أحمد');
  });
});

describe('validateDisplayName', () => {
  it.each([
    'Sara',
    'Sara Ali',
    'سارة أحمد',
    'Sara سارة',
    "Jean-Luc O'Brien",
    'Dr.Ahmed',
    '123',
    'A',
  ])('accepts %s', (input) => {
    expect(codeOf(input)).toBe('ok');
  });

  it('returns the sanitized value', () => {
    expect(validateDisplayName(` Sa${chars(0x200e)}ra   Ali `)).toEqual({
      ok: true,
      displayName: 'Sara Ali',
    });
  });

  it('rejects empty input and input that is empty after cleaning', () => {
    expect(codeOf('')).toBe('empty');
    expect(codeOf('   ')).toBe('empty');
    expect(codeOf(`${chars(0x200b)}${chars(0x202e)}`)).toBe('empty');
  });

  it('counts characters as code points, with a limit of 50', () => {
    expect(codeOf('a'.repeat(DISPLAY_NAME_MAX_LENGTH))).toBe('ok');
    expect(codeOf('a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toBe('too_long');
    const emoji = chars(0x1f600);
    const mixed = `${emoji.repeat(25)}${'a'.repeat(25)}`; // 50 code points, 75 UTF-16 units
    expect(mixed.length).toBe(75);
    expect(codeOf(mixed)).toBe('ok');
    expect(codeOf(`${mixed}a`)).toBe('too_long');
  });

  it('needs at least one letter or digit', () => {
    expect(codeOf(chars(0x1f600))).toBe('no_letter_or_digit');
    expect(codeOf('!!! ---')).toBe('no_letter_or_digit');
    expect(codeOf(`${chars(0x1f600)} 7`)).toBe('ok');
  });

  it('rejects @ in all its look-alike forms', () => {
    expect(codeOf('sara@home')).toBe('contains_at');
    expect(codeOf(`sara${chars(0xff20)}home`)).toBe('contains_at');
    expect(codeOf(`sara${chars(0xfe6b)}home`)).toBe('contains_at');
  });

  it.each(['http://evil.example', 'visit www.evil.example', 'evil.com', 'my.site.io', 'HTTPS://X'])(
    'rejects the URL-like name %s',
    (input) => {
      expect(codeOf(input)).toBe('contains_url');
    },
  );

  it('does not treat dots inside ordinary names as URLs', () => {
    expect(codeOf('Dr.Ahmed')).toBe('ok');
    expect(codeOf('J.R.R. Tolkien')).toBe('ok');
    expect(codeOf('company')).toBe('ok');
  });

  it.each(['Admin', 'ADMIN', 'A d m i n', 'Support', 'System', 'adm1n', 'LetterApp'])(
    'rejects the reserved name %s',
    (input) => {
      expect(codeOf(input)).toBe('reserved');
    },
  );

  it('does not reserve names that merely contain a reserved word', () => {
    expect(codeOf('Admin Sara')).toBe('ok');
    expect(codeOf('Helpful Hana')).toBe('ok');
  });
});
