import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable } from 'react-native';

import { useTheme } from '@/core/theme/useTheme';
import { getDiscoveryRepository } from '@/data/discovery/discoveryRepository';

/**
 * "…" on a person (search result, connection request): Report or Block (DEC-013: available
 * everywhere a person appears, independent of receive_mode and connection state). Block asks
 * first; the blocked person is never told. `onBlocked` lets the list drop the row.
 */
export function PersonActionsButton({
  userId,
  onBlocked,
  testID,
}: {
  userId: string;
  onBlocked?: () => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  function confirmBlock() {
    Alert.alert(t('letter.blockConfirmTitle'), t('letter.blockConfirmMessage'), [
      { text: t('compose.sendConfirmCancel'), style: 'cancel' },
      {
        text: t('letter.block'),
        style: 'destructive',
        onPress: () =>
          void (async () => {
            try {
              await getDiscoveryRepository().blockUser(userId);
              onBlocked?.();
            } catch {
              Alert.alert(t('letters.error.unknown'));
            }
          })(),
      },
    ]);
  }

  function open() {
    Alert.alert(t('safety.actionsTitle'), undefined, [
      { text: t('compose.sendConfirmCancel'), style: 'cancel' },
      {
        text: t('letter.report'),
        onPress: () => router.push({ pathname: '/report', params: { userId } }),
      },
      { text: t('letter.block'), style: 'destructive', onPress: confirmBlock },
    ]);
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('safety.actionsTitle')}
      onPress={open}
      hitSlop={spacing.sm}
      style={{ padding: spacing.xs }}
    >
      <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
    </Pressable>
  );
}
