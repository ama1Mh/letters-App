import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { currentLanguage } from '@/core/i18n';
import { formatDate } from '@/core/i18n/format';
import { useTheme } from '@/core/theme/useTheme';
import { getDraftsRepository } from '@/data/letters/draftsRepository';
import {
  getLettersRepository,
  type ListCursor,
  type SentItem,
  type SentKind,
} from '@/data/letters/lettersRepository';
import { CorrespondentName } from '@/features/letters/CorrespondentName';
import { letterErrorKey, type TranslatedLetterError } from '@/features/letters/letterErrors';
import { usePagedList } from '@/features/letters/usePagedList';

const WHEN_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

/**
 * Sent tab (DEC-046 (1), DEC-048 M4): a Scheduled / Sent switch over `list_sent`. The chosen kind
 * lives in the route's `view` param, so other screens can open the tab on a kind (compose lands
 * on Scheduled after scheduling). Each kind's list is its own component, keyed by kind, so
 * switching starts from a clean list instead of briefly showing the other kind's rows.
 */
export default function SentScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const kind: SentKind = view === 'scheduled' ? 'scheduled' : 'sent';

  const kinds: { kind: SentKind; label: string }[] = [
    { kind: 'scheduled', label: t('sent.tabScheduled') },
    { kind: 'sent', label: t('sent.tabSent') },
  ];

  return (
    <View testID="sent-screen" style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          margin: spacing.lg,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          overflow: 'hidden',
        }}
      >
        {kinds.map((option) => {
          const selected = option.kind === kind;
          return (
            <Pressable
              key={option.kind}
              testID={`sent-switch-${option.kind}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => router.setParams({ view: option.kind })}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: spacing.sm,
                backgroundColor: selected ? colors.primary : 'transparent',
              }}
            >
              <AppText
                style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: '600' }}
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <SentList key={kind} kind={kind} />
    </View>
  );
}

function SentList({ kind }: { kind: SentKind }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  const loadPage = useCallback(
    (cursor: ListCursor | null) => getLettersRepository().listSent(kind, cursor),
    [kind],
  );
  const list = usePagedList(loadPage);
  const { reload } = list;

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<TranslatedLetterError | 'unknown' | null>(null);
  const [unscheduledNotice, setUnscheduledNotice] = useState(false);

  // Every visit: a letter scheduled or delivered since the last look should show up.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  function confirmUnschedule(item: SentItem) {
    Alert.alert(t('sent.unscheduleConfirmTitle'), t('sent.unscheduleConfirmMessage'), [
      { text: t('sent.unscheduleConfirmCancel'), style: 'cancel' },
      {
        text: t('sent.unschedule'),
        style: 'destructive',
        onPress: () => void unschedule(item.id),
      },
    ]);
  }

  async function unschedule(id: string) {
    setBusyId(id);
    setActionError(null);
    setUnscheduledNotice(false);
    try {
      await getLettersRepository().unscheduleLetter(id);
      list.removeItem(id);
      setUnscheduledNotice(true);
      // It is a draft again on the server; pull it back into the local drafts list (best effort:
      // the Drafts tab syncs again on its next visit anyway).
      void getDraftsRepository()
        .sync()
        .catch(() => undefined);
    } catch (e) {
      setActionError(letterErrorKey(e));
      // Delivered or gone in the meantime: the row is stale, so refresh the list.
      void reload();
    } finally {
      setBusyId(null);
    }
  }

  function renderItem({ item }: { item: SentItem }) {
    const language = currentLanguage();
    let status: string;
    if (item.status === 'scheduled' && item.scheduledAt) {
      status = t('sent.scheduledFor', {
        when: formatDate(new Date(item.scheduledAt), language, WHEN_FORMAT),
      });
    } else if (item.status === 'undeliverable') {
      status = t('sent.undeliverable');
    } else {
      status = t('sent.deliveredAt', {
        when: formatDate(new Date(item.deliveredAt ?? item.sortAt), language, WHEN_FORMAT),
      });
    }

    return (
      <View
        testID={`sent-row-${item.id}`}
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: spacing.xs,
        }}
      >
        <CorrespondentName person={item.recipient} prefix={t('sent.to')} />
        {item.subject ? <AppText>{item.subject}</AppText> : null}
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
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <AppText
            testID={`sent-row-${item.id}-status`}
            variant="muted"
            style={item.status === 'undeliverable' ? { color: colors.danger } : undefined}
          >
            {status}
          </AppText>
          {item.readAt ? (
            <AppText testID={`sent-row-${item.id}-read`} variant="muted">
              {t('sent.read')}
            </AppText>
          ) : null}
        </View>
        {item.status === 'scheduled' ? (
          <Button
            testID={`sent-row-${item.id}-unschedule`}
            title={t('sent.unschedule')}
            variant="secondary"
            loading={busyId === item.id}
            disabled={busyId !== null}
            onPress={() => confirmUnschedule(item)}
          />
        ) : null}
      </View>
    );
  }

  const banner = actionError ? (
    <AppText
      testID="sent-action-error"
      style={{ color: colors.danger, paddingHorizontal: spacing.lg }}
    >
      {t(`letters.error.${actionError}`)}
    </AppText>
  ) : unscheduledNotice ? (
    <AppText testID="sent-unscheduled-notice" style={{ paddingHorizontal: spacing.lg }}>
      {t('sent.unscheduled')}
    </AppText>
  ) : null;

  if (list.loading) {
    return <ActivityIndicator testID="sent-loading" style={{ marginTop: spacing.xl }} />;
  }

  if (list.items.length === 0) {
    if (list.error) {
      return (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <AppText testID="sent-load-error" style={{ color: colors.danger }}>
            {t(`letters.error.${list.error}`)}
          </AppText>
          <Button testID="sent-retry" title={t('sent.retry')} onPress={() => void reload()} />
        </View>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        {banner}
        <EmptyState
          testID={kind === 'scheduled' ? 'sent-scheduled-empty' : 'sent-empty'}
          title={kind === 'scheduled' ? t('sent.scheduledEmptyTitle') : t('sent.emptyTitle')}
          body={kind === 'scheduled' ? t('sent.scheduledEmptyBody') : t('sent.emptyBody')}
        />
      </View>
    );
  }

  return (
    <FlatList
      testID={`sent-list-${kind}`}
      data={list.items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={
        <>
          {banner}
          {list.error ? (
            <AppText
              testID="sent-load-error"
              style={{ color: colors.danger, paddingHorizontal: spacing.lg }}
            >
              {t(`letters.error.${list.error}`)}
            </AppText>
          ) : null}
        </>
      }
      ListFooterComponent={
        list.loadingMore ? (
          <ActivityIndicator testID="sent-loading-more" style={{ margin: spacing.md }} />
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
  );
}
