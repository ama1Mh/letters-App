/**
 * Unicode bidi isolation for inline text. Pure: no React Native imports.
 *
 * `ltrIsolate()` wraps text that must always read left-to-right (an `@username`, a time zone name
 * such as `Asia/Riyadh`) in LEFT-TO-RIGHT ISOLATE (U+2066) ... POP DIRECTIONAL ISOLATE (U+2069), so
 * inside Arabic (RTL) text it neither reorders itself nor drags neighbouring punctuation along.
 */
const LRI = '⁦';
const PDI = '⁩';

export function ltrIsolate(text: string): string {
  return `${LRI}${text}${PDI}`;
}
