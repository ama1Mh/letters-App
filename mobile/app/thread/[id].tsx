import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { currentLanguage } from '@/core/i18n';
import { contentTextAlign } from '@/core/i18n/direction';
import { formatDate } from '@/core/i18n/format';
import { useTheme } from '@/core/theme/useTheme';
import { getDraftsRepository } from '@/data/letters/draftsRepository';
import { getLettersRepository, type ThreadItem } from '@/data/letters/lettersRepository';
import { defaultDesign } from '@/domain/design';
import { CorrespondentName } from '@/features/letters/CorrespondentName';
import { useLetterEvents } from '@/features/letters/LetterEventsProvider';
import { letterErrorKey, type TranslatedLetterError } from '@/features/letters/letterErrors';

const WHEN_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

/**
 * A conversation (Phase 8): the letters of one thread I may see, oldest first (`list_thread`).
 * Mine sit on the end side and theirs on the start side, using logical margins, so the layout
 * mirrors correctly in RTL; each letter's preview keeps its own direction. Tapping one opens the
 * reading view. "Reply" answers the latest letter I received. Refreshes on letter events.
 */
export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();

  const [items, setItems] = useState<ThreadItem[] | null>(null);
  const [error, setError] = useState<TranslatedLetterError | 'unknown' | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const loaded = await getLettersRepository().listThread(id);
      if (!alive.current) return;
      setItems(loaded);
      setError(null);
    } catch (e) {
      if (alive.current) setError(letterErrorKey(e));
    }
  }, [id]);

  useEffect(() => {
    // Async IIFE, the same as useDrafts / AuthProvider (react-hooks/set-state-in-effect).
    void (async () => {
      await load();
    })();
  }, [load]);

  useLetterEvents(() => void load());

  if (error) {
    return (
      <View testID="thread-error" style={{ flex: 1, padding: spacing.lg }}>
        <AppText style={{ color: colors.danger }}>{t(`letters.error.${error}`)}</AppText>
      </View>
    );
  }
  if (!items) {
    return <ActivityIndicator testID="thread-loading" style={{ marginTop: spacing.xl }} />;
  }

  const language = currentLanguage();
  const other = items[0]?.other;
  const lastReceived = [...items]
    .reverse()
    .find((item) => !item.isMine && item.status === 'delivered');

  async function onReply(parent: ThreadItem) {
    const draft = await getDraftsRepository().save({
      subject: null,
      body: '',
      design: defaultDesign(),
      recipientId: parent.other.id,
      parentLetterId: parent.id,
    });
    router.push(`/compose/${draft.id}`);
  }

  return (
    <ScrollView
      testID="thread-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
    >
      {other ? <CorrespondentName testID="thread-other" person={other} /> : null}
      {items.map((item) => {
        let when: string;
        if (item.status === 'scheduled' && item.scheduledAt) {
          when = t('sent.scheduledFor', {
            when: formatDate(new Date(item.scheduledAt), language, WHEN_FORMAT),
          });
        } else if (item.status === 'undeliverable') {
          when = t('sent.undeliverable');
        } else {
          when = formatDate(new Date(item.deliveredAt ?? item.sortAt), language, WHEN_FORMAT);
        }
        return (
          <Pressable
            key={item.id}
            testID={`thread-item-${item.id}`}
            accessibilityRole="button"
            accessibilityHint={item.isMine ? t('thread.mine') : t('thread.theirs')}
            onPress={() => router.push(`/letter/${item.id}`)}
            style={{
              // Mine on the end side, theirs on the start side (logical, mirrors in RTL).
              marginStart: item.isMine ? spacing.xl : 0,
              marginEnd: item.isMine ? 0 : spacing.xl,
              padding: spacing.md,
              gap: spacing.xs,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: item.isMine ? colors.surface : colors.background,
            }}
          >
            <AppText variant="muted">{item.isMine ? t('thread.mine') : t('thread.theirs')}</AppText>
            {item.subject ? <AppText variant="title">{item.subject}</AppText> : null}
            <AppText
              numberOfLines={3}
              style={{ textAlign: contentTextAlign(item.bodyDir), writingDirection: item.bodyDir }}
            >
              {item.preview}
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <AppText testID={`thread-item-${item.id}-when`} variant="muted">
                {when}
              </AppText>
              {item.isMine && item.readAt ? (
                <AppText testID={`thread-item-${item.id}-read`} variant="muted">
                  {t('sent.read')}
                </AppText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      {lastReceived ? (
        <Button
          testID="thread-reply"
          title={t('letter.reply')}
          onPress={() => void onReply(lastReceived)}
        />
      ) : null}
    </ScrollView>
  );
}
