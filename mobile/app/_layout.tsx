import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

import { initI18n } from '@/core/i18n';
import { useTheme } from '@/core/theme/useTheme';
import { AuthProvider } from '@/features/auth/AuthProvider';

// Must run before the first render: sets language and aligns layout direction (may reload once).
initI18n();

export default function RootLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <AuthProvider>
      <StatusBar style="auto" />
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
      </Stack>
    </AuthProvider>
  );
}
