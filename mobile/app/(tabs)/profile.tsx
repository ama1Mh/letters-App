import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { DirectionalIcon } from '@/components/DirectionalIcon';
import { useTheme } from '@/core/theme/useTheme';
import { useAuth } from '@/features/auth/AuthProvider';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const auth = useAuth();
  const languageName = i18n.language === 'ar' ? t('language.arabic') : t('language.english');

  async function onSignOut() {
    await auth.signOut();
    router.replace('/'); // back through the gate, which now sees no session
  }

  return (
    <View testID="profile-screen" style={{ flex: 1, backgroundColor: colors.background }}>
      <Pressable
        testID="profile-language-row"
        accessibilityRole="button"
        onPress={() => router.push('/settings/language')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText style={{ flex: 1 }}>{t('profile.language')}</AppText>
        <AppText variant="muted">{languageName}</AppText>
        <DirectionalIcon name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
      <Pressable
        testID="profile-sign-out-row"
        accessibilityRole="button"
        onPress={() => void onSignOut()}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText style={{ flex: 1, color: colors.danger }}>{t('auth.signOut')}</AppText>
      </Pressable>
    </View>
  );
}
