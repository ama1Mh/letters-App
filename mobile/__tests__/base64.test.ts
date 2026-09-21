import { Base64Error, base64ToBytes, bytesToBase64 } from '../src/core/encoding/base64';

const ascii = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0));

describe('base64', () => {
  // RFC 4648 section 10 test vectors.
  it.each([
    ['', ''],
    ['f', 'Zg=='],
    ['fo', 'Zm8='],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg=='],
    ['fooba', 'Zm9vYmE='],
    ['foobar', 'Zm9vYmFy'],
  ])('encodes and decodes %j', (text, encoded) => {
    expect(bytesToBase64(ascii(text))).toBe(encoded);
    expect(Array.from(base64ToBytes(encoded))).toEqual(Array.from(ascii(text)));
  });

  it('round-trips every byte value and every length up to 64', () => {
    const all = Uint8Array.from({ length: 256 }, (_, index) => index);
    expect(Array.from(base64ToBytes(bytesToBase64(all)))).toEqual(Array.from(all));
    for (let length = 0; length <= 64; length++) {
      const bytes = all.slice(200, 200 + length);
      expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
    }
  });

  it('matches Node for random-looking data', () => {
    const bytes = Uint8Array.from({ length: 1000 }, (_, index) => (index * 37 + 11) % 256);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });

  it('decodes the URL-safe alphabet and missing padding', () => {
    // 0xfb 0xff 0xbf encodes to "+/+/" in the standard alphabet and "-_-_" in the URL-safe one.
    expect(Array.from(base64ToBytes('-_-_'))).toEqual([0xfb, 0xff, 0xbf]);
    expect(Array.from(base64ToBytes('+/+/'))).toEqual([0xfb, 0xff, 0xbf]);
    expect(Array.from(base64ToBytes('Zm9vYg'))).toEqual(Array.from(ascii('foob')));
    expect(Array.from(base64ToBytes('Zm8'))).toEqual(Array.from(ascii('fo')));
  });

  it.each(['Zg=x', 'Z', 'Zm9vY', 'a b c', 'Zm9v!', 'ZZZZZ'])(
    'rejects invalid input %j',
    (input) => {
      expect(() => base64ToBytes(input)).toThrow(Base64Error);
    },
  );
});
