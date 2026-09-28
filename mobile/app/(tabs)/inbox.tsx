import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { currentLanguage } from '@/core/i18n';
import { formatDate } from '@/core/i18n/format';
import { useTheme } from '@/core/theme/useTheme';
import {
  getLettersRepository,
  type InboxItem,
  type ListCursor,
} from '@/data/letters/lettersRepository';
import { CorrespondentName } from '@/features/letters/CorrespondentName';
import { useLetterEvents } from '@/features/letters/LetterEventsProvider';
import { usePagedList } from '@/features/letters/usePagedList';

const WHEN_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

/**
 * Inbox (DEC-048 M5): delivered letters addressed to me, newest first, via `list_inbox`. Unread
 * letters (read_at null) are marked; opening one (reading view) marks it read, and the list
 * reloads on every focus, so the marker is gone on return. Realtime events, reconnects and
 * returning to the foreground also reload it (LetterEventsProvider).
 */
export default function InboxScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const loadPage = useCallback(
    (cursor: ListCursor | null) => getLettersRepository().listInbox(cursor),
    [],
  );
  const list = usePagedList(loadPage);
  const { reload } = list;

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  // Live: a delivery, a read or a reconnect/foreground refetches (DEC-048 M7).
  useLetterEvents(() => void reload());

  function renderItem({ item }: { item: InboxItem }) {
    const unread = item.readAt === null;
    return (
      <Pressable
        testID={`inbox-row-${item.id}`}
        accessibilityRole="button"
        accessibilityHint={unread ? t('inbox.unread') : undefined}
        onPress={() => router.push(`/letter/${item.id}`)}
        style={{
          flexDirection: 'row',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          testID={unread ? `inbox-row-${item.id}-unread` : undefined}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            marginTop: spacing.sm,
            backgroundColor: unread ? colors.primary : 'transparent',
          }}
        />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <CorrespondentName person={item.sender} />
          {item.subject ? (
            <AppText style={{ fontWeight: unread ? '700' : '400' }}>{item.subject}</AppText>
          ) : null}
          {item.preview ? (
            <AppText
              variant="muted"
              numberOfLines={2}
              // The letter's own direction (body_dir), independent of the UI's (see drafts list).
              style={{
                textAlign: item.bodyDir === 'rtl' ? 'right' : 'left',
                writingDirection: item.bodyDir,
              }}
            >
              {item.preview}
            </AppText>
          ) : null}
          <AppText variant="muted">
            {formatDate(new Date(item.deliveredAt), currentLanguage(), WHEN_FORMAT)}
          </AppText>
        </View>
      </Pressable>
    );
  }

  if (list.loading) {
    return (
      <View testID="inbox-screen" style={{ flex: 1, backgroundColor: colors.background }}>
        <ActivityIndicator testID="inbox-loading" style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  if (list.items.length === 0) {
    return (
      <View testID="inbox-screen" style={{ flex: 1, backgroundColor: colors.background }}>
        {list.error ? (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <AppText testID="inbox-load-error" style={{ color: colors.danger }}>
              {t(`letters.error.${list.error}`)}
            </AppText>
            <Button testID="inbox-retry" title={t('sent.retry')} onPress={() => void reload()} />
          </View>
        ) : (
          <EmptyState
            testID="inbox-empty"
            title={t('inbox.emptyTitle')}
            body={t('inbox.emptyBody')}
          />
        )}
      </View>
    );
  }

  return (
    <View testID="inbox-screen" style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        testID="inbox-list"
        data={list.items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          list.error ? (
            <AppText
              testID="inbox-load-error"
              style={{ color: colors.danger, paddingHorizontal: spacing.lg }}
            >
              {t(`letters.error.${list.error}`)}
            </AppText>
          ) : null
        }
        ListFooterComponent={
          list.loadingMore ? (
            <ActivityIndicator testID="inbox-loading-more" style={{ margin: spacing.md }} />
          ) : null
        }
        onEndReached={() => void list.loadMore()}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={list.refreshing}
            onRefresh={() => void reload({ pull: true })}
          />
        }
      />
    </View>
  );
}
