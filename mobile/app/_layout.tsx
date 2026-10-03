import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { OfflineBoundary } from '@/components/OfflineBanner';
import { initI18n } from '@/core/i18n';
import { initCrashReporting } from '@/core/monitoring/crashReporting';
import { useTheme } from '@/core/theme/useTheme';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useDesignFonts } from '@/features/designs/useDesignFonts';
import { LetterEventsProvider } from '@/features/letters/LetterEventsProvider';
import { NotificationsProvider } from '@/features/notifications/NotificationsProvider';
import { installForegroundNotificationHandler } from '@/features/notifications/pushPlatform';

// First, so a crash during startup is reported too (no-op without a DSN; see the module).
initCrashReporting({
  environment: String(Constants.expoConfig?.extra?.variant ?? 'dev'),
  release: Constants.expoConfig?.version,
});
// Must run before the first render: sets language and aligns layout direction (may reload once).
initI18n();
// Also before the first render, so a delivery that arrives during startup is still shown.
installForegroundNotificationHandler();

export default function RootLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  useDesignFonts(); // loaded once, app-wide; see the hook for why nothing needs to wait on it

  return (
    // Root for gesture-handler (the letter canvas, Phase 12); a plain flex view otherwise.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <LetterEventsProvider>
          <NotificationsProvider>
            <StatusBar style="auto" />
            <OfflineBoundary>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.text,
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="settings/language" options={{ title: t('language.title') }} />
                <Stack.Screen name="settings/privacy" options={{ title: t('privacy.title') }} />
                <Stack.Screen name="settings/blocked" options={{ title: t('blocked.title') }} />
                <Stack.Screen
                  name="settings/notifications"
                  options={{ title: t('notifications.title') }}
                />
                <Stack.Screen name="settings/avatar" options={{ title: t('avatar.title') }} />
                <Stack.Screen name="compose/[id]" options={{ title: t('compose.title') }} />
                <Stack.Screen name="compose/pick-recipient" options={{ headerShown: false }} />
                <Stack.Screen name="letter/[id]" options={{ title: t('letter.title') }} />
                <Stack.Screen name="thread/[id]" options={{ title: t('thread.title') }} />
                <Stack.Screen name="report" options={{ title: t('report.title') }} />
                <Stack.Screen name="legal/privacy" options={{ title: t('legal.privacyTitle') }} />
                <Stack.Screen name="legal/terms" options={{ title: t('legal.termsTitle') }} />
                <Stack.Screen name="connections" options={{ title: t('connections.title') }} />
                <Stack.Screen name="invite/index" options={{ title: t('invite.title') }} />
                <Stack.Screen name="invite/[code]" options={{ headerShown: false }} />
              </Stack>
            </OfflineBoundary>
          </NotificationsProvider>
        </LetterEventsProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
