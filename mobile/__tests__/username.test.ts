import {
  isReservedWord,
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  usernameSkeleton,
  validateUsername,
  type UsernameErrorCode,
} from '../src/domain/username';

function codeOf(input: string): UsernameErrorCode | 'ok' {
  const result = validateUsername(input);
  return result.ok ? 'ok' : result.code;
}

describe('validateUsername', () => {
  it.each(['sara', 'sara_92', 'abc', 'a1b', 'user_name_1', 'z9x'])('accepts %s', (input) => {
    expect(codeOf(input)).toBe('ok');
  });

  it('accepts the exact minimum and maximum lengths', () => {
    expect(codeOf('a'.repeat(USERNAME_MIN_LENGTH))).toBe('ok');
    expect(codeOf('a'.repeat(USERNAME_MAX_LENGTH))).toBe('ok');
  });

  it('normalizes case and surrounding spaces, and returns the stored form', () => {
    expect(normalizeUsername('  Sara_92 ')).toBe('sara_92');
    const result = validateUsername('  Sara_92 ');
    expect(result).toEqual({ ok: true, username: 'sara_92', skeleton: 'sara92' });
  });

  it.each([
    ['sara-92', 'invalid_characters'],
    ['sara 92', 'invalid_characters'],
    ['sara.92', 'invalid_characters'],
    ['ab!', 'invalid_characters'],
    ['سارة', 'invalid_characters'], // Arabic letters: Latin only (DEC-010)
    ['1abc', 'must_start_with_letter'],
    ['_abc', 'must_start_with_letter'],
    ['abc_', 'trailing_underscore'],
    ['a__b', 'consecutive_underscores'],
    ['ab', 'too_short'],
    ['a', 'too_short'],
    ['', 'too_short'],
    ['a'.repeat(USERNAME_MAX_LENGTH + 1), 'too_long'],
  ] as const)('rejects %j with %s', (input, code) => {
    expect(codeOf(input)).toBe(code);
  });

  it('reports the first failing rule (characters before length)', () => {
    expect(codeOf('a!')).toBe('invalid_characters');
    expect(codeOf('_a')).toBe('must_start_with_letter');
  });

  it.each(['admin', 'Admin', 'ADMINISTRATOR', 'support', 'root', 'www', 'letterapp'])(
    'rejects the reserved word %s',
    (input) => {
      expect(codeOf(input)).toBe('reserved');
    },
  );

  it.each(['ad_min', 'adm1n', 'admln', 'letterap_p', 'supp0rt', 'r00t'])(
    'rejects the look-alike of a reserved word: %s',
    (input) => {
      expect(codeOf(input)).toBe('reserved');
    },
  );

  it('does not reserve ordinary names that merely contain a reserved word', () => {
    expect(codeOf('admin_sara')).toBe('ok');
    expect(codeOf('helpful')).toBe('ok');
    expect(codeOf('rootbeer')).toBe('ok');
  });
});

describe('usernameSkeleton', () => {
  it.each([
    ['paypa1', 'paypal'],
    ['paypai', 'paypal'],
    ['rnia', 'mia'],
    ['a_b', 'ab'],
    ['vvin', 'win'],
    ['g00gle', 'google'],
    ['5ara', 'sara'],
  ])('%s and %s share a skeleton', (a, b) => {
    expect(usernameSkeleton(a)).toBe(usernameSkeleton(b));
  });

  it.each([
    ['sara', 'sarah'],
    ['mia', 'mira'],
    ['ab', 'ba'],
  ])('%s and %s do not collide', (a, b) => {
    expect(usernameSkeleton(a)).not.toBe(usernameSkeleton(b));
  });

  it('applies the documented order: underscores, rn, vv, then single characters', () => {
    expect(usernameSkeleton('r_n')).toBe('m'); // underscore removed first, then rn -> m
    expect(usernameSkeleton('rn1')).toBe('ml');
    expect(usernameSkeleton('vv0')).toBe('wo');
    expect(usernameSkeleton('rrnn')).toBe('rmn'); // one pass, no re-scan
  });

  it('is stable when applied twice', () => {
    for (const sample of ['paypa1', 'rrnn', 'vvvv', 'a_b_c', 'mi5s1ss1pp1']) {
      expect(usernameSkeleton(usernameSkeleton(sample))).toBe(usernameSkeleton(sample));
    }
  });
});

describe('isReservedWord', () => {
  it('is true for reserved words and their look-alikes only', () => {
    expect(isReservedWord('Admin')).toBe(true);
    expect(isReservedWord('adm1n')).toBe(true);
    expect(isReservedWord('sara')).toBe(false);
  });
});
