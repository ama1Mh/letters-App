/**
 * Single source of truth for app identity (DEC-001).
 * Nothing else in the repo may hard-code the name, slug, scheme or package ID.
 *
 * The public name is final (Mirsal / مرسال, DEC-055, 2026-10-01). The slug, scheme and package IDs
 * below are still TEMPORARY and development-only: they move to production
 * values with the credential migration (OPEN-2) and must never be published as they are.
 */

export const APP_VARIANTS = ['dev', 'preview', 'production'] as const;
export type AppVariant = (typeof APP_VARIANTS)[number];

export interface BrandConfig {
  variant: AppVariant;
  /** Launcher label (English/default). In-app text uses the i18n key `app.name`, not this. */
  name: string;
  /** Launcher label on devices whose language is Arabic. */
  nameAr: string;
  /** Expo project slug. Identical across variants (identifies the EAS project). */
  slug: string;
  /** URL scheme. Invite links are `<scheme>://invite/<code>` (DEC-012). */
  scheme: string;
  /** Android application ID. */
  androidPackage: string;
  /** Contact address shown in the privacy policy and terms (DEC-053/054; owner's value, DEC-058). */
  contactEmail: string;
  /** Operator named in the privacy policy and terms (owner's value, DEC-058). */
  operatorName: string;
}

const PUBLIC_NAME = 'Mirsal';
const PUBLIC_NAME_AR = 'مرسال';
const SLUG = 'letterapp';
const ANDROID_PACKAGE_BASE = 'com.letterapp';
// Owner's confirmed OPEN-6 values (DEC-058, 2026-10-01).
const CONTACT_EMAIL = 'amal.m.faqihi@gmail.com';
const OPERATOR_NAME = 'Amal Faqihi';

/**
 * Brand words that usernames and display names may not take (DEC-010): the dev slug and the public
 * name in both scripts. The database keeps its own copy of this list, so change both together.
 */
/** The public name in both scripts, for the in-app wordmark (Phase 13, BrandMark). */
export const BRAND_WORDMARK = { latin: PUBLIC_NAME, arabic: PUBLIC_NAME_AR } as const;

export const RESERVED_BRAND_WORDS: readonly string[] = [SLUG, 'mirsal', PUBLIC_NAME_AR];

const DEFAULT_VARIANT: AppVariant = 'dev';

const NON_PRODUCTION: Record<Exclude<AppVariant, 'production'>, BrandConfig> = {
  dev: {
    variant: 'dev',
    name: `${PUBLIC_NAME} (Dev)`,
    nameAr: `${PUBLIC_NAME_AR} (تطوير)`,
    slug: SLUG,
    scheme: 'letterapp',
    androidPackage: `${ANDROID_PACKAGE_BASE}.dev`, // DEC-001
    contactEmail: CONTACT_EMAIL,
    operatorName: OPERATOR_NAME,
  },
  preview: {
    variant: 'preview',
    name: `${PUBLIC_NAME} (Preview)`,
    nameAr: `${PUBLIC_NAME_AR} (معاينة)`,
    slug: SLUG,
    scheme: 'letterapp-preview',
    androidPackage: `${ANDROID_PACKAGE_BASE}.preview`,
    contactEmail: CONTACT_EMAIL,
    operatorName: OPERATOR_NAME,
  },
};

export function resolveVariant(value: string | undefined): AppVariant {
  if (value === undefined || value === '') return DEFAULT_VARIANT;
  if ((APP_VARIANTS as readonly string[]).includes(value)) return value as AppVariant;
  throw new Error(`Unknown APP_VARIANT "${value}". Expected one of: ${APP_VARIANTS.join(', ')}.`);
}

export function getBrandConfig(variant: AppVariant = DEFAULT_VARIANT): BrandConfig {
  if (variant === 'production') {
    // Deliberately unresolvable until the naming freeze (OPEN-2 in docs/DECISIONS.md).
    throw new Error(
      'Production identity is not defined yet (OPEN-2: naming freeze). ' +
        'Set the final name, package ID and scheme in brand.config.ts first.',
    );
  }
  return NON_PRODUCTION[variant];
}
