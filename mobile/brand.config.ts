/**
 * Single source of truth for app identity (DEC-001).
 * Nothing else in the repo may hard-code the name, slug, scheme or package ID.
 *
 * All values below are TEMPORARY and development-only. The production identity is
 * decided at the naming freeze (OPEN-2) and must never reuse a temporary ID.
 */

export const APP_VARIANTS = ['dev', 'preview', 'production'] as const;
export type AppVariant = (typeof APP_VARIANTS)[number];

export interface BrandConfig {
  variant: AppVariant;
  /** Launcher label. In-app text uses the i18n key `app.name`, not this. */
  name: string;
  /** Expo project slug. Identical across variants (identifies the EAS project). */
  slug: string;
  /** URL scheme. Invite links are `<scheme>://invite/<code>` (DEC-012). */
  scheme: string;
  /** Android application ID. */
  androidPackage: string;
}

const TEMPORARY_NAME = 'LetterApp';
const SLUG = 'letterapp';
const ANDROID_PACKAGE_BASE = 'com.letterapp';

/**
 * Brand words that usernames and display names may not take (DEC-010). Add the final brand at the
 * naming freeze (OPEN-2). The database keeps its own copy of this list, so change both together.
 */
export const RESERVED_BRAND_WORDS: readonly string[] = [SLUG];

const DEFAULT_VARIANT: AppVariant = 'dev';

const NON_PRODUCTION: Record<Exclude<AppVariant, 'production'>, BrandConfig> = {
  dev: {
    variant: 'dev',
    name: `${TEMPORARY_NAME} (Dev)`,
    slug: SLUG,
    scheme: 'letterapp',
    androidPackage: `${ANDROID_PACKAGE_BASE}.dev`, // DEC-001
  },
  preview: {
    variant: 'preview',
    name: `${TEMPORARY_NAME} (Preview)`,
    slug: SLUG,
    scheme: 'letterapp-preview',
    androidPackage: `${ANDROID_PACKAGE_BASE}.preview`,
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
