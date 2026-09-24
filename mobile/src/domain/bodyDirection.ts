/**
 * Letter body direction detection (PLAN §3.5, DEC-014): `body_dir` is the direction of the first
 * "strong" character in the body, skipping digits, punctuation and whitespace — those are weak or
 * neutral and carry no direction of their own (Unicode Bidirectional Algorithm, UAX #9, rules
 * P2/P3). This is not a full UAX #9 implementation, only enough of the "first strong character"
 * rule to distinguish the two scripts this app supports (Arabic vs Latin). Pure TypeScript: no
 * React, no Supabase. The database does not re-derive this; the app computes it once on save and
 * stores it, so a letter renders identically to both sides regardless of either UI's language
 * (independent of the *viewer's* direction, which core/i18n/direction.ts controls separately).
 */
export type TextDirection = 'ltr' | 'rtl';

/**
 * Arabic-script blocks (strong RTL), by numeric code point rather than a literal character range:
 * Prettier re-serializes a regex (or string) literal's `\u` escapes as the literal characters
 * themselves, and one of the block boundaries here is U+FEFF - the BOM, one of the exact invisible
 * characters DEC-010 says never to embed unescaped. Built via `String.fromCharCode` instead, so
 * nothing literal ever lands in source no matter how Prettier formats it.
 */
const RTL_BLOCKS: readonly (readonly [number, number])[] = [
  [0x0590, 0x05ff], // Hebrew (also strong RTL; harmless to get right even though unused by the UI)
  [0x0600, 0x06ff], // Arabic
  [0x0700, 0x074f], // Syriac
  [0x0750, 0x077f], // Arabic Supplement
  [0x08a0, 0x08ff], // Arabic Extended-A
  [0xfb1d, 0xfdff], // Hebrew / Arabic Presentation Forms A
  [0xfe70, 0xfeff], // Arabic Presentation Forms B
];

const RTL_STRONG = new RegExp(
  `[${RTL_BLOCKS.map(([from, to]) => `${String.fromCharCode(from)}-${String.fromCharCode(to)}`).join('')}]`,
  'u',
);

// Any other letter (Latin, Cyrillic, Greek, CJK, ...) counts as strong LTR for this app's binary
// ltr/rtl model. Checked only after RTL_STRONG, since Arabic/Hebrew letters also match \p{L}.
const LTR_STRONG = /\p{L}/u;

/**
 * `fallback` is the sender's UI direction (PLAN §3.5): used only when the body has no strong
 * character at all (empty, all digits/punctuation/whitespace, emoji-only, ...).
 */
export function detectBodyDirection(body: string, fallback: TextDirection): TextDirection {
  for (const char of body) {
    // `for...of` walks by code point, so a surrogate pair is never split mid-character.
    if (RTL_STRONG.test(char)) return 'rtl';
    if (LTR_STRONG.test(char)) return 'ltr';
  }
  return fallback;
}
