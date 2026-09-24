/**
 * Runtime access to `brand.config.ts` (DEC-001). `app.config.ts` resolves the variant at build time
 * and threads it through as `extra.variant`; this reads it back via `expo-constants` so runtime code
 * (for now: the password-reset deep-link scheme) never hard-codes the scheme.
 */
import Constants from 'expo-constants';

import { getBrandConfig, type AppVariant, type BrandConfig } from '../../../brand.config';

let cached: BrandConfig | null = null;

export function currentBrand(): BrandConfig {
  cached ??= getBrandConfig(Constants.expoConfig?.extra?.variant as AppVariant | undefined);
  return cached;
}
