/**
 * Narrows a possibly-wide error code down to one of the codes a screen actually has a translation
 * for, falling back to `'unknown'`. `Array.prototype.includes()` is not a type guard, so a plain
 * ternary on it keeps `code`'s original (wider) type in the "true" branch - which breaks i18next's
 * typed `t()` when the wider type includes codes that are not translation keys under the namespace
 * being interpolated into. This makes the narrowing an explicit, typed return instead.
 */
export function knownErrorKey<Known extends string>(
  code: string,
  known: readonly Known[],
): Known | 'unknown' {
  return (known as readonly string[]).includes(code) ? (code as Known) : 'unknown';
}
