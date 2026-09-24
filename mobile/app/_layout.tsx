import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

import { initI18n } from '@/core/i18n';
import { useTheme } from '@/core/theme/useTheme';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useDesignFonts } from '@/features/designs/useDesignFonts';

// Must run before the first render: sets language and aligns layout direction (may reload once).
initI18n();

export default function RootLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  useDesignFonts(); // loaded once, app-wide; see the hook for why nothing needs to wait on it

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
        <Stack.Screen name="compose/[id]" options={{ title: t('compose.title') }} />
        <Stack.Screen name="compose/pick-design" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
