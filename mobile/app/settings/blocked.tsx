import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/core/theme/useTheme';
import { getDiscoveryRepository, type BlockedUser } from '@/data/discovery/discoveryRepository';
import { CorrespondentName } from '@/features/letters/CorrespondentName';

/**
 * People I blocked (Phase 9, DEC-013), with Unblock. Only my own blocks are listed - never who
 * blocked me. Unblocking does not restore a removed connection; the person can be connected again
 * the normal way (request or invite).
 */
export default function BlockedScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  const [items, setItems] = useState<BlockedUser[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await getDiscoveryRepository().listBlockedUsers());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onUnblock(userId: string) {
    setBusyId(userId);
    try {
      await getDiscoveryRepository().unblockUser(userId);
      setItems((current) => (current ? current.filter((item) => item.userId !== userId) : current));
    } catch {
      setFailed(true);
    } finally {
      setBusyId(null);
    }
  }

  if (failed && !items) {
    return (
      <View testID="blocked-error" style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
        <AppText style={{ color: colors.danger }}>{t('letters.error.unknown')}</AppText>
        <Button testID="blocked-retry" title={t('sent.retry')} onPress={() => void load()} />
      </View>
    );
  }
  if (!items) {
    return <ActivityIndicator testID="blocked-loading" style={{ marginTop: spacing.xl }} />;
  }
  if (items.length === 0) {
    return (
      <EmptyState
        testID="blocked-empty"
        title={t('blocked.emptyTitle')}
        body={t('blocked.emptyBody')}
      />
    );
  }

  return (
    <FlatList
      testID="blocked-screen"
      style={{ backgroundColor: colors.background }}
      data={items}
      keyExtractor={(item) => item.userId}
      ListHeaderComponent={
        failed ? (
          <AppText style={{ color: colors.danger, padding: spacing.lg }}>
            {t('letters.error.unknown')}
          </AppText>
        ) : null
      }
      renderItem={({ item }) => (
        <View
          testID={`blocked-row-${item.userId}`}
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
          <View style={{ flex: 1 }}>
            <CorrespondentName
              person={{
                id: item.userId,
                username: item.username,
                displayName: item.displayName,
                avatarKey: item.avatarKey,
              }}
            />
          </View>
          <Button
            testID={`blocked-unblock-${item.userId}`}
            title={t('blocked.unblock')}
            variant="secondary"
            loading={busyId === item.userId}
            disabled={busyId !== null}
            onPress={() => void onUnblock(item.userId)}
          />
        </View>
      )}
    />
  );
}
