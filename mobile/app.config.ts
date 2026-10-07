import type { ExpoConfig } from 'expo/config';

// The explicit .ts extension is required: Expo loads this file as CommonJS via Node's native
// TypeScript stripping, which does not resolve extensionless .ts imports.
import { getBrandConfig, resolveVariant } from './brand.config.ts';

const brand = getBrandConfig(resolveVariant(process.env.APP_VARIANT));

// Push (Phase 7, DEC-050). Both come from the owner's accounts and are tied to the final package
// ID, so they are read from the environment, never committed (DEC-001): `EAS_PROJECT_ID` (public
// id from `eas init`) and `GOOGLE_SERVICES_JSON` (path to Firebase's google-services.json, an EAS
// file variable on EAS builds). Without them the app runs and simply does not register for push.
const easProjectId = process.env.EAS_PROJECT_ID || undefined;
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || undefined;

const config: ExpoConfig = {
  name: brand.name,
  slug: brand.slug,
  scheme: brand.scheme,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  // Arabic launcher label (values-b+ar/strings.xml). English is `name` above.
  locales: { ar: { android: { app_name: brand.nameAr } } },
  android: {
    package: brand.androidPackage,
    ...(googleServicesFile ? { googleServicesFile } : {}),
    adaptiveIcon: {
      backgroundColor: '#F6F0E3', // aged cream behind the stamp mark (DEC-065)
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    // `letters` must match the channelId sent by supabase/functions/send-notifications. The icon is
    // the status-bar small icon: white on transparent (Android uses only its alpha); `color` tints
    // it in the shade (heritage green, src/core/theme/tokens.ts). The icon is the stamp silhouette.
    [
      'expo-notifications',
      {
        defaultChannel: 'letters',
        icon: './assets/images/notification-icon.png',
        color: '#2F5B48', // heritage green, palette B primary (DEC-063)
      },
    ],
    // Declares en/ar to the OS (per-app language on Android 13+) and RTL support. `forcesRTL` is
    // deliberately unset: direction is managed at runtime by src/core/i18n/direction.ts.
    ['expo-localization', { supportsRTL: true, supportedLocales: ['en', 'ar'] }],
    [
      'expo-splash-screen',
      {
        // The stamp mark on aged cream, or on the night ground in dark mode (DEC-065).
        backgroundColor: '#F6F0E3',
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
        dark: { backgroundColor: '#161B17', image: './assets/images/splash-icon.png' },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    variant: brand.variant,
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },
};

export default config;
