import { type ConfigPlugin, withAppBuildGradle } from 'expo/config-plugins.js';

/**
 * Signs release builds with the owner's upload key instead of the debug key (2026-10-08, the
 * friends' preview APK). Gradle reads the key's location and passwords from the environment at
 * build time, so neither the repo nor the generated android/ project holds them. Without
 * MIRSAL_UPLOAD_STORE_FILE a release build falls back to the debug key, as before.
 */
const ENV_FILE = 'MIRSAL_UPLOAD_STORE_FILE';

const RELEASE_SIGNING = `
        release {
            if (System.getenv('${ENV_FILE}')) {
                storeFile file(System.getenv('${ENV_FILE}'))
                storePassword System.getenv('MIRSAL_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('MIRSAL_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('MIRSAL_UPLOAD_KEY_PASSWORD')
            }
        }`;

const DEBUG_RELEASE_LINE = /(release \{\n(?:\s*\/\/.*\n)*\s*)signingConfig signingConfigs\.debug/;

export const withReleaseSigning: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes(ENV_FILE)) return mod;
    if (!gradle.includes('signingConfigs {') || !DEBUG_RELEASE_LINE.test(gradle)) {
      throw new Error(
        'withReleaseSigning: android/app/build.gradle no longer matches the template',
      );
    }
    gradle = gradle.replace('signingConfigs {', `signingConfigs {${RELEASE_SIGNING}`);
    gradle = gradle.replace(
      DEBUG_RELEASE_LINE,
      `$1signingConfig System.getenv('${ENV_FILE}') ? signingConfigs.release : signingConfigs.debug`,
    );
    mod.modResults.contents = gradle;
    return mod;
  });
