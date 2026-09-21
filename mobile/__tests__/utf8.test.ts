import { decodeUtf8, encodeUtf8, Utf8Error } from '../src/core/encoding/utf8';

const nodeBytes = (text: string) => Array.from(Buffer.from(text, 'utf8'));

describe('utf8', () => {
  it.each([
    'plain ascii',
    '',
    'café',
    'سارة أحمد',
    '你好',
    '\u{1f600} emoji \u{1f1f8}\u{1f1e6}',
    'mixed العربية and English 123',
    '{"user_metadata":{"name":"سارة"}}',
  ])('encodes like Node and round-trips %j', (text) => {
    expect(Array.from(encodeUtf8(text))).toEqual(nodeBytes(text));
    expect(decodeUtf8(encodeUtf8(text))).toBe(text);
  });

  it('replaces a lone surrogate with U+FFFD, as TextEncoder does', () => {
    expect(Array.from(encodeUtf8('a\ud800b'))).toEqual(nodeBytes('a\ud800b'));
  });

  it.each([
    ['a truncated sequence', [0xe2, 0x82]],
    ['a stray continuation byte', [0x80]],
    ['an invalid start byte', [0xff]],
    ['an overlong two-byte encoding', [0xc0, 0x80]],
    ['an overlong three-byte encoding', [0xe0, 0x80, 0x80]],
    ['an encoded surrogate', [0xed, 0xa0, 0x80]],
    ['a code point above U+10FFFF', [0xf4, 0x90, 0x80, 0x80]],
    ['a bad continuation byte', [0xe2, 0x28, 0xa1]],
  ])('rejects %s', (_label, bytes) => {
    expect(() => decodeUtf8(Uint8Array.from(bytes))).toThrow(Utf8Error);
  });
});
