import type { ExpoConfig } from 'expo/config';

// The explicit .ts extension is required: Expo loads this file as CommonJS via Node's native
// TypeScript stripping, which does not resolve extensionless .ts imports.
import { getBrandConfig, resolveVariant } from './brand.config.ts';

const brand = getBrandConfig(resolveVariant(process.env.APP_VARIANT));

const config: ExpoConfig = {
  name: brand.name,
  slug: brand.slug,
  scheme: brand.scheme,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  android: {
    package: brand.androidPackage,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    // Declares en/ar to the OS (per-app language on Android 13+) and RTL support. `forcesRTL` is
    // deliberately unset: direction is managed at runtime by src/core/i18n/direction.ts.
    ['expo-localization', { supportsRTL: true, supportedLocales: ['en', 'ar'] }],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    variant: brand.variant,
  },
};

export default config;
