/**
 * Strict UTF-8 without TextEncoder/TextDecoder, which Hermes may not provide. Session JSON can
 * carry non-ASCII text (for example an Arabic display name), so this must be exact.
 */

export class Utf8Error extends Error {
  constructor() {
    super('invalid_utf8');
    this.name = 'Utf8Error';
  }
}

export function encodeUtf8(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const char of text) {
    // for...of iterates by code point, so surrogate pairs arrive joined. A lone surrogate is
    // replaced by U+FFFD, as TextEncoder does.
    let code = char.codePointAt(0) as number;
    if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd;

    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}

/** Throws Utf8Error on malformed, overlong, surrogate or out-of-range sequences. */
export function decodeUtf8(bytes: Uint8Array): string {
  let out = '';
  let index = 0;
  while (index < bytes.length) {
    const first = bytes[index];
    let length: number;
    let code: number;
    let minimum: number;

    if (first < 0x80) {
      length = 1;
      code = first;
      minimum = 0;
    } else if (first >= 0xc2 && first <= 0xdf) {
      length = 2;
      code = first & 0x1f;
      minimum = 0x80;
    } else if (first >= 0xe0 && first <= 0xef) {
      length = 3;
      code = first & 0x0f;
      minimum = 0x800;
    } else if (first >= 0xf0 && first <= 0xf4) {
      length = 4;
      code = first & 0x07;
      minimum = 0x10000;
    } else {
      throw new Utf8Error();
    }

    if (index + length > bytes.length) throw new Utf8Error();
    for (let offset = 1; offset < length; offset++) {
      const next = bytes[index + offset];
      if ((next & 0xc0) !== 0x80) throw new Utf8Error();
      code = (code << 6) | (next & 0x3f);
    }
    const isSurrogate = code >= 0xd800 && code <= 0xdfff;
    if (code < minimum || code > 0x10ffff || isSurrogate) throw new Utf8Error();

    out += String.fromCodePoint(code);
    index += length;
  }
  return out;
}
