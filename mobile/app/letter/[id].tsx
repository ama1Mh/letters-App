import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { currentLanguage } from '@/core/i18n';
import { formatDate } from '@/core/i18n/format';
import { useTheme } from '@/core/theme/useTheme';
import { getLettersRepository, type Letter } from '@/data/letters/lettersRepository';
import { LetterRenderer } from '@/features/designs/LetterRenderer';
import { CorrespondentName } from '@/features/letters/CorrespondentName';
import { letterErrorKey, type TranslatedLetterError } from '@/features/letters/letterErrors';

const WHEN_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

/**
 * Reading view (DEC-048 M6): one letter through `get_letter`, rendered with LetterRenderer in the
 * letter's stored direction (body_dir), independent of the UI language. The recipient marks it read
 * on open (once; `mark_read` is idempotent server-side). Every "can't see it" case shows the same
 * neutral message, never why (CLAUDE.md: no revealing blocks or existence).
 */
export default function LetterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  const [letter, setLetter] = useState<Letter | null>(null);
  const [error, setError] = useState<TranslatedLetterError | 'unknown' | null>(null);
  const markedRead = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await getLettersRepository().getLetter(id);
        if (cancelled) return;
        setLetter(loaded);
        if (loaded.viewerRole === 'recipient' && loaded.readAt === null && !markedRead.current) {
          markedRead.current = true;
          try {
            const readAt = await getLettersRepository().markRead(id);
            if (!cancelled) setLetter((current) => (current ? { ...current, readAt } : current));
          } catch {
            // Best effort: the letter is still readable; it stays unread and is retried next open.
            markedRead.current = false;
          }
        }
      } catch (e) {
        if (!cancelled) setError(letterErrorKey(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    // not_found for every invisible case; anything else (e.g. offline) gets the generic text.
    return (
      <View testID="letter-error" style={{ flex: 1, padding: spacing.lg }}>
        <AppText style={{ color: colors.danger }}>{t(`letters.error.${error}`)}</AppText>
      </View>
    );
  }

  if (!letter) {
    return <ActivityIndicator testID="letter-loading" style={{ marginTop: spacing.xl }} />;
  }

  const language = currentLanguage();
  const isRecipient = letter.viewerRole === 'recipient';
  let when: string | null = null;
  if (letter.status === 'scheduled' && letter.scheduledAt) {
    when = t('sent.scheduledFor', {
      when: formatDate(new Date(letter.scheduledAt), language, WHEN_FORMAT),
    });
  } else if (letter.status === 'undeliverable') {
    when = t('sent.undeliverable');
  } else if (letter.deliveredAt) {
    when = t('sent.deliveredAt', {
      when: formatDate(new Date(letter.deliveredAt), language, WHEN_FORMAT),
    });
  }

  return (
    <ScrollView
      testID="letter-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
    >
      <CorrespondentName
        testID="letter-correspondent"
        person={isRecipient ? letter.sender : letter.recipient}
        prefix={isRecipient ? t('letter.from') : t('sent.to')}
      />
      {when ? (
        <AppText testID="letter-when" variant="muted">
          {when}
        </AppText>
      ) : null}
      {!isRecipient && letter.readAt ? (
        <AppText testID="letter-read" variant="muted">
          {t('sent.read')}
        </AppText>
      ) : null}
      <LetterRenderer
        testID="letter-body"
        design={letter.design}
        subject={letter.subject}
        body={letter.body}
        bodyDir={letter.bodyDir}
      />
    </ScrollView>
  );
}
