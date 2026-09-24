import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SectionList, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/core/theme/useTheme';
import {
  DiscoveryActionError,
  getDiscoveryRepository,
  type ConnectionRow,
} from '@/data/discovery/discoveryRepository';

type Section = {
  key: 'incoming' | 'outgoing';
  titleKey: 'connections.incomingTitle' | 'connections.outgoingTitle';
  data: ConnectionRow[];
};

/** Incoming/outgoing connection requests inbox (PLAN §3.6/DEC-007). Reached from the profile tab;
 *  removing an already-*accepted* connection is not exposed here - there is no "connections list"
 *  screen yet (out of Phase 5's scope; PLAN assigns it later), only the pending-request inbox. */
export default function ConnectionsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [sections, setSections] = useState<Section[]>([]);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { incoming, outgoing } = await getDiscoveryRepository().listPendingConnections();
    setSections([
      { key: 'incoming', titleKey: 'connections.incomingTitle', data: incoming },
      { key: 'outgoing', titleKey: 'connections.outgoingTitle', data: outgoing },
    ]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function act(id: string, action: (id: string) => Promise<void>) {
    setError(null);
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await action(id);
      await load();
    } catch (e) {
      const code = e instanceof DiscoveryActionError ? e.code : 'unknown';
      const known = code === 'not_found' || code === 'not_pending' ? code : 'unknown';
      setError(t(`connections.error.${known}`));
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const totalCount = sections.reduce((sum, s) => sum + s.data.length, 0);

  if (totalCount === 0 && sections.length > 0) {
    return (
      <EmptyState
        testID="connections-empty"
        title={t('connections.emptyTitle')}
        body={t('connections.emptyBody')}
      />
    );
  }

  return (
    <View testID="connections-screen" style={{ flex: 1, backgroundColor: colors.background }}>
      {error ? (
        <AppText testID="connections-error" style={{ color: colors.danger, padding: spacing.lg }}>
          {error}
        </AppText>
      ) : null}
      <SectionList
        sections={sections.filter((s) => s.data.length > 0)}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <AppText
            variant="muted"
            style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}
          >
            {t(section.titleKey)}
          </AppText>
        )}
        renderItem={({ item, section }) => {
          const busy = busyIds.has(item.id);
          const name = item.otherDisplayName ?? item.otherUsername ?? '';
          return (
            <View
              testID={`connections-row-${item.id}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <AppText style={{ flex: 1 }}>{name}</AppText>
              {section.key === 'incoming' ? (
                <>
                  <Button
                    testID={`connections-accept-${item.id}`}
                    title={t('connections.accept')}
                    loading={busy}
                    onPress={() =>
                      void act(item.id, (id) => getDiscoveryRepository().acceptConnection(id))
                    }
                  />
                  <Button
                    testID={`connections-decline-${item.id}`}
                    title={t('connections.decline')}
                    variant="secondary"
                    loading={busy}
                    onPress={() =>
                      void act(item.id, (id) => getDiscoveryRepository().declineConnection(id))
                    }
                  />
                </>
              ) : (
                <Button
                  testID={`connections-cancel-${item.id}`}
                  title={t('connections.cancel')}
                  variant="secondary"
                  loading={busy}
                  onPress={() =>
                    void act(item.id, (id) => getDiscoveryRepository().cancelConnectionRequest(id))
                  }
                />
              )}
            </View>
          );
        }}
      />
    </View>
  );
}
