import { INTL_LOCALES, type Language } from './languages';

/** Always goes through INTL_LOCALES so the calendar and digits are pinned (DEC-014). */
export function formatDate(
  value: Date | number,
  language: Language,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return new Intl.DateTimeFormat(INTL_LOCALES[language], options).format(value);
}

export function formatNumber(
  value: number,
  language: Language,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(INTL_LOCALES[language], options).format(value);
}
