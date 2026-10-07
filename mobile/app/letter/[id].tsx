import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { currentLanguage } from '@/core/i18n';
import { formatDate } from '@/core/i18n/format';
import { useTheme } from '@/core/theme/useTheme';
import { getDiscoveryRepository } from '@/data/discovery/discoveryRepository';
import { getDraftsRepository } from '@/data/letters/draftsRepository';
import { getLettersRepository, type Letter } from '@/data/letters/lettersRepository';
import { defaultDesign } from '@/domain/design';
import { useAuth } from '@/features/auth/AuthProvider';
import { CorrespondentName } from '@/features/letters/CorrespondentName';
import { useLetterEvents } from '@/features/letters/LetterEventsProvider';
import { LetterReader } from '@/features/letters/LetterReader';
import { letterErrorKey, type TranslatedLetterError } from '@/features/letters/letterErrors';

/** letters.subject is limited to 120 characters (letters_subject_length). */
const REPLY_SUBJECT_MAX = 120;

const WHEN_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

/**
 * Reading view (DEC-048 M6): one letter through `get_letter`, rendered with LetterReader (the designed sheet, zoom, or plain text) in the
 * letter's stored direction (body_dir), independent of the UI language. The recipient marks it read
 * on open (once; `mark_read` is idempotent server-side). Every "can't see it" case shows the same
 * neutral message, never why (CLAUDE.md: no revealing blocks or existence).
 */
export default function LetterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [letter, setLetter] = useState<Letter | null>(null);
  const [error, setError] = useState<TranslatedLetterError | 'unknown' | null>(null);
  const [actionNotice, setActionNotice] = useState<'letter.blocked' | null>(null);
  const [actionError, setActionError] = useState(false);
  const markedRead = useRef(false);
  // "Today" for a dated postmark on a letter that has no date yet; fixed when the screen opens.
  const [openedAt] = useState(() => Date.now());
  const { profile } = useAuth();
  const myId = profile?.id ?? null;

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const loaded = await getLettersRepository().getLetter(id);
      if (!alive.current) return;
      setLetter(loaded);
      setError(null);
      if (loaded.viewerRole === 'recipient' && loaded.readAt === null && !markedRead.current) {
        markedRead.current = true;
        try {
          const readAt = await getLettersRepository().markRead(id);
          if (alive.current) setLetter((current) => (current ? { ...current, readAt } : current));
        } catch {
          // Best effort: the letter is still readable; it stays unread and is retried next open.
          markedRead.current = false;
        }
      }
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

  // Live: e.g. the sender sees "Read" appear, or a scheduled letter turn delivered. Other letters'
  // events are ignored; reconnect/foreground refetches.
  useLetterEvents((reason, events) => {
    if (reason !== 'event' || events.some((event) => event.letterId === id)) void load();
  });

  if (error) {
    // not_found for every invisible case; anything else (e.g. offline) gets the generic text.
    return (
      <View testID="letter-error" style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
        <AppText style={{ color: colors.danger }}>{t(`letters.error.${error}`)}</AppText>
        {error !== 'not_found' ? (
          <Button testID="letter-retry" title={t('sent.retry')} onPress={() => void load()} />
        ) : null}
      </View>
    );
  }

  if (!letter) {
    return <ActivityIndicator testID="letter-loading" style={{ marginTop: spacing.xl }} />;
  }

  const language = currentLanguage();
  const isRecipient = letter.viewerRole === 'recipient';

  // Phase 8: a reply is a new local draft to the sender, pointing at this letter (the server
  // checks the parent and fixes the recipient). Subject "Re: …" when the letter had one.
  async function onReply(parent: Letter) {
    const subject = parent.subject
      ? t('letter.replySubject', { subject: parent.subject }).slice(0, REPLY_SUBJECT_MAX)
      : null;
    const draft = await getDraftsRepository().save({
      subject,
      body: '',
      design: defaultDesign(),
      recipientId: parent.sender.id,
      parentLetterId: parent.id,
    });
    router.push(`/compose/${draft.id}`);
  }

  // Phase 9 (DEC-013, DEC-023): the other person on this letter, delete-for-me, block, report.
  const other = isRecipient ? letter.sender : letter.recipient;
  const canDeleteForMe =
    (isRecipient && letter.status === 'delivered') ||
    (!isRecipient && (letter.status === 'delivered' || letter.status === 'undeliverable'));

  function confirmDeleteForMe(target: Letter) {
    Alert.alert(t('letter.deleteConfirmTitle'), t('letter.deleteConfirmMessage'), [
      { text: t('compose.sendConfirmCancel'), style: 'cancel' },
      {
        text: t('letter.deleteForMe'),
        style: 'destructive',
        onPress: () =>
          void (async () => {
            setActionError(false);
            try {
              await getLettersRepository().deleteLetterForMe(target.id);
              router.back();
            } catch {
              setActionError(true);
            }
          })(),
      },
    ]);
  }

  function confirmBlock(userId: string) {
    Alert.alert(t('letter.blockConfirmTitle'), t('letter.blockConfirmMessage'), [
      { text: t('compose.sendConfirmCancel'), style: 'cancel' },
      {
        text: t('letter.block'),
        style: 'destructive',
        onPress: () =>
          void (async () => {
            setActionError(false);
            try {
              await getDiscoveryRepository().blockUser(userId);
              setActionNotice('letter.blocked');
            } catch {
              setActionError(true);
            }
          })(),
      },
    ]);
  }

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
      <LetterReader
        testID="letter-body"
        design={letter.design}
        subject={letter.subject}
        body={letter.body}
        bodyDir={letter.bodyDir}
        postmarkDate={new Date(letter.deliveredAt ?? letter.scheduledAt ?? openedAt)}
      />
      {isRecipient && letter.status === 'delivered' ? (
        <Button
          testID="letter-reply"
          variant="seal"
          title={t('letter.reply')}
          onPress={() => void onReply(letter)}
        />
      ) : null}
      <Button
        testID="letter-conversation"
        title={t('letter.viewConversation')}
        variant="secondary"
        onPress={() => router.push(`/thread/${letter.threadId}`)}
      />
      {actionNotice ? <AppText testID="letter-notice">{t(actionNotice)}</AppText> : null}
      {actionError ? (
        <AppText testID="letter-action-error" style={{ color: colors.danger }}>
          {t('letters.error.unknown')}
        </AppText>
      ) : null}
      {canDeleteForMe ? (
        <Button
          testID="letter-delete-for-me"
          title={t('letter.deleteForMe')}
          variant="secondary"
          onPress={() => confirmDeleteForMe(letter)}
        />
      ) : null}
      {other && other.id !== myId ? (
        <>
          <Button
            testID="letter-block"
            title={t('letter.block')}
            variant="secondary"
            onPress={() => confirmBlock(other.id)}
          />
          <Button
            testID="letter-report"
            title={t('letter.report')}
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/report',
                params: { userId: other.id, letterId: letter.id },
              })
            }
          />
        </>
      ) : null}
    </ScrollView>
  );
}
