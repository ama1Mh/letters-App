import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { DirectionalIcon } from '@/components/DirectionalIcon';
import { useTheme } from '@/core/theme/useTheme';
import { useAuth } from '@/features/auth/AuthProvider';

/** Notification preference (DEC-052): push on delivery, saved immediately like privacy.tsx. Only
 *  the push is silenced; letters still arrive. The OS-level switch lives in the phone's settings. */
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const auth = useAuth();
  const [pushOnDelivery, setPushOnDelivery] = useState(auth.profile?.pushOnDelivery ?? true);
  const [saveFailed, setSaveFailed] = useState(false);

  async function apply(next: boolean) {
    setPushOnDelivery(next);
    setSaveFailed(false);
    try {
      await auth.repository.updatePushOnDelivery(next);
    } catch {
      setPushOnDelivery(!next);
      setSaveFailed(true);
      return;
    }
    await auth.refresh();
  }

  return (
    <ScrollView
      testID="notifications-screen"
      contentContainerStyle={{ paddingVertical: spacing.lg }}
      style={{ backgroundColor: colors.background }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText style={{ flex: 1 }}>{t('notifications.pushOnDeliveryLabel')}</AppText>
        <Switch
          testID="notifications-push-on-delivery"
          accessibilityLabel={t('notifications.pushOnDeliveryLabel')}
          value={pushOnDelivery}
          onValueChange={(next) => void apply(next)}
        />
      </View>
      <AppText variant="muted" style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        {t('notifications.pushOnDeliveryHint')}
      </AppText>
      {saveFailed ? (
        <AppText
          testID="notifications-save-error"
          accessibilityLiveRegion="polite"
          style={{ color: colors.danger, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}
        >
          {t('notifications.saveError')}
        </AppText>
      ) : null}

      <Pressable
        testID="notifications-open-system-settings"
        accessibilityRole="button"
        onPress={() => void Linking.openSettings()}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
          marginTop: spacing.lg,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
      >
        <AppText style={{ flex: 1 }}>{t('notifications.openSystemSettings')}</AppText>
        <DirectionalIcon name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    </ScrollView>
  );
}
