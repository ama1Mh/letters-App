/**
 * TEMPORARY (Phase 1 spike, OPEN-4). Diagnostic labels and sample text for app/spike.tsx.
 * Deliberately NOT in the i18n catalogs: this screen is dev-only (`__DEV__`) and is deleted
 * after the spike, so it must not add rows to docs/ARABIC_REVIEW.md.
 */

// Unicode isolates: wrap text that must keep its own direction inside opposite-direction text.
export const LRI = '⁦';
export const PDI = '⁩';

export const SAMPLE_ARABIC = 'عزيزي أحمد، أتمنى أن تكون بخير. اشتقت إليك كثيراً.';
export const SAMPLE_LATIN = 'Dear Ahmed, I hope you are well. I miss you a lot.';
export const SAMPLE_MIXED =
  'مرحباً Ahmed، رقم الطلب 12345 وموعدنا 2026/09/20 عبر letterapp://invite/K7Q2M9XPAB';

/** [key, sample] — each row is rendered plain and with the username isolated. */
export const MIXED_LINES: readonly {
  key: string;
  before: string;
  username: string;
  after: string;
}[] = [
  { key: 'ar-with-username', before: 'وصلتني رسالة من ', username: '@sara_92', after: ' اليوم.' },
  {
    key: 'ar-with-digits',
    before: 'سيصلك الخطاب بعد ',
    username: '3',
    after: ' أيام (أو 2 ساعة).',
  },
  {
    key: 'en-with-arabic',
    before: 'Letter from ',
    username: '@omar_k',
    after: ' — "أهلاً وسهلاً"!',
  },
];

export const FONT_FAMILIES = ['sans-serif', 'sans-serif-medium', 'serif', 'monospace'] as const;
export const FONT_WEIGHTS = ['400', '600', '700'] as const;

export const LABELS = {
  runtime: 'Runtime',
  input: 'Bidi TextInput',
  inputHint:
    'Type with the emulator keyboard, switch keyboard language, place the caret, and note alignment, caret side and selection.',
  fillArabic: 'Arabic',
  fillLatin: 'Latin',
  fillMixed: 'Mixed',
  fillClear: 'Clear',
  inputDefault: 'No textAlign (platform default)',
  inputAuto: "textAlign: 'auto'",
  firstStrong: 'First-strong direction',
  mixed: 'Mixed-script rendering',
  mixedPlain: 'plain',
  mixedIsolated: 'username isolated (LRI…PDI)',
  fonts: 'Arabic fonts (system families)',
  intl: 'Intl (Hermes)',
  intlBare: 'bare locales below show what to avoid',
  plurals: 'Arabic plural categories',
  datePicker:
    'Native date picker language: NOT in this build. Needs @react-native-community/datetimepicker (native module, requires a rebuild). Awaiting owner approval.',
  language: 'Language switch and reload',
  openLanguage: 'Open language settings',
  reloadNow: 'Reload app now',
  dev: 'Development builds only',
} as const;
