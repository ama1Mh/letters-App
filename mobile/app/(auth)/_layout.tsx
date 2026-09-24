import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/useTheme';

export default function AuthLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ title: t('auth.signUp.title') }} />
      <Stack.Screen name="forgot-password" options={{ title: t('auth.forgotPassword.title') }} />
      {/* No back gesture: onboarding is not optional once signed in (see app/index.tsx gate). */}
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}
