/**
 * Base64 (RFC 4648) without Buffer or atob, which React Native / Hermes may not provide.
 * Decoding accepts both the standard and the URL-safe alphabet, with or without padding.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const LOOKUP: Record<string, number> = {};
for (let index = 0; index < ALPHABET.length; index++) LOOKUP[ALPHABET[index]] = index;

export class Base64Error extends Error {
  constructor() {
    super('invalid_base64');
    this.name = 'Base64Error';
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const remaining = bytes.length - index;
    const chunk = (bytes[index] << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
    out += ALPHABET[(chunk >> 18) & 63] + ALPHABET[(chunk >> 12) & 63];
    out += remaining > 1 ? ALPHABET[(chunk >> 6) & 63] : '=';
    out += remaining > 2 ? ALPHABET[chunk & 63] : '=';
  }
  return out;
}

export function base64ToBytes(input: string): Uint8Array {
  const text = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/={0,2}$/, '');
  // A base64 body can never have length 1 (mod 4), and only alphabet characters are allowed.
  if (text.length % 4 === 1 || /[^A-Za-z0-9+/]/.test(text)) throw new Base64Error();

  const bytes = new Uint8Array(Math.floor((text.length * 3) / 4));
  let written = 0;
  for (let index = 0; index < text.length; index += 4) {
    const a = LOOKUP[text[index]];
    const b = LOOKUP[text[index + 1]];
    const c = index + 2 < text.length ? LOOKUP[text[index + 2]] : 0;
    const d = index + 3 < text.length ? LOOKUP[text[index + 3]] : 0;
    const chunk = (a << 18) | (b << 12) | (c << 6) | d;
    bytes[written++] = (chunk >> 16) & 255;
    if (index + 2 < text.length) bytes[written++] = (chunk >> 8) & 255;
    if (index + 3 < text.length) bytes[written++] = chunk & 255;
  }
  return bytes;
}
