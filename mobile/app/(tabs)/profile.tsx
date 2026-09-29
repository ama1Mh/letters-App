import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { DirectionalIcon } from '@/components/DirectionalIcon';
import { ltrIsolate } from '@/core/i18n/bidi';
import { useTheme } from '@/core/theme/useTheme';
import { avatarSourceFromKey } from '@/domain/avatar';
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

  // Phase 9 (PLAN §6.5): two confirmations, then the delete-account Edge Function.
  function confirmDeleteAccount() {
    Alert.alert(t('profile.deleteAccountTitle'), t('profile.deleteAccountMessage'), [
      { text: t('compose.sendConfirmCancel'), style: 'cancel' },
      {
        text: t('profile.deleteAccountContinue'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            t('profile.deleteAccountFinalTitle'),
            t('profile.deleteAccountFinalMessage'),
            [
              { text: t('compose.sendConfirmCancel'), style: 'cancel' },
              {
                text: t('profile.deleteAccount'),
                style: 'destructive',
                onPress: () => void onDeleteAccount(),
              },
            ],
          ),
      },
    ]);
  }

  async function onDeleteAccount() {
    try {
      await auth.deleteAccount();
      router.replace('/');
    } catch {
      Alert.alert(t('profile.deleteAccountFailed'));
    }
  }

  return (
    <View testID="profile-screen" style={{ flex: 1, backgroundColor: colors.background }}>
      <Pressable
        testID="profile-avatar-row"
        accessibilityRole="button"
        accessibilityHint={t('avatar.change')}
        onPress={() => router.push('/settings/avatar')}
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
        <Avatar source={avatarSourceFromKey(auth.profile?.avatarKey)} size={56} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="title">{auth.profile?.displayName ?? ''}</AppText>
          {auth.profile?.username ? (
            <AppText variant="muted">{ltrIsolate(`@${auth.profile.username}`)}</AppText>
          ) : null}
          <AppText style={{ color: colors.primary }}>{t('avatar.change')}</AppText>
        </View>
        <DirectionalIcon name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
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
        testID="profile-connections-row"
        accessibilityRole="button"
        onPress={() => router.push('/connections')}
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
        <AppText style={{ flex: 1 }}>{t('profile.connections')}</AppText>
        <DirectionalIcon name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
      <Pressable
        testID="profile-my-invite-row"
        accessibilityRole="button"
        onPress={() => router.push('/invite')}
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
        <AppText style={{ flex: 1 }}>{t('profile.myInvite')}</AppText>
        <DirectionalIcon name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
      <Pressable
        testID="profile-privacy-row"
        accessibilityRole="button"
        onPress={() => router.push('/settings/privacy')}
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
        <AppText style={{ flex: 1 }}>{t('profile.privacy')}</AppText>
        <DirectionalIcon name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
      <Pressable
        testID="profile-notifications-row"
        accessibilityRole="button"
        onPress={() => router.push('/settings/notifications')}
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
        <AppText style={{ flex: 1 }}>{t('profile.notifications')}</AppText>
        <DirectionalIcon name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
      <Pressable
        testID="profile-blocked-row"
        accessibilityRole="button"
        onPress={() => router.push('/settings/blocked')}
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
        <AppText style={{ flex: 1 }}>{t('profile.blocked')}</AppText>
        <DirectionalIcon name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
      <Pressable
        testID="profile-privacy-policy-row"
        accessibilityRole="button"
        onPress={() => router.push('/legal/privacy')}
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
        <AppText style={{ flex: 1 }}>{t('profile.privacyPolicy')}</AppText>
        <DirectionalIcon name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
      <Pressable
        testID="profile-terms-row"
        accessibilityRole="button"
        onPress={() => router.push('/legal/terms')}
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
        <AppText style={{ flex: 1 }}>{t('profile.terms')}</AppText>
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
      <Pressable
        testID="profile-delete-account-row"
        accessibilityRole="button"
        onPress={confirmDeleteAccount}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
        }}
      >
        <AppText style={{ flex: 1, color: colors.danger }}>{t('profile.deleteAccount')}</AppText>
      </Pressable>
    </View>
  );
}
