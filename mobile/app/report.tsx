import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useTheme } from '@/core/theme/useTheme';
import { getDiscoveryRepository } from '@/data/discovery/discoveryRepository';
import {
  REPORT_REASONS,
  getLettersRepository,
  type ReportReason,
} from '@/data/letters/lettersRepository';
import { letterErrorKey, type TranslatedLetterError } from '@/features/letters/letterErrors';

/** Matches reports_details_length on the server. */
const DETAILS_MAX = 500;

/**
 * Report a person (DEC-013, Phase 9), optionally about the letter it was opened from. Reports go to
 * the `reports` table, reviewed in the Supabase dashboard; the reported person is never told.
 * "Also block" blocks right after the report succeeds.
 */
export default function ReportScreen() {
  const { userId, letterId } = useLocalSearchParams<{ userId: string; letterId?: string }>();
  const { t } = useTranslation();
  const { colors, spacing, radius, fontSize } = useTheme();
  const router = useRouter();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<TranslatedLetterError | 'unknown' | null>(null);

  async function onSubmit() {
    if (!reason) return;
    setSending(true);
    setError(null);
    try {
      await getLettersRepository().reportUser(
        userId,
        reason,
        letterId ?? null,
        details.trim() || null,
      );
      if (alsoBlock) await getDiscoveryRepository().blockUser(userId);
      setDone(true);
    } catch (e) {
      setError(letterErrorKey(e));
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <View testID="report-done" style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
        <AppText>{t('report.sent')}</AppText>
        <Button testID="report-close" title={t('report.close')} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView
      testID="report-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
    >
      <AppText variant="title">{t('report.reasonLabel')}</AppText>
      {REPORT_REASONS.map((option) => {
        const selected = option === reason;
        return (
          <Pressable
            key={option}
            testID={`report-reason-${option}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => setReason(option)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.md,
              borderWidth: 1,
              borderRadius: radius.md,
              borderColor: selected ? colors.primary : colors.border,
            }}
          >
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={selected ? colors.primary : colors.textMuted}
            />
            <AppText style={{ flex: 1 }}>{t(`report.reason.${option}`)}</AppText>
          </Pressable>
        );
      })}
      <AppText variant="muted">{t('report.detailsLabel')}</AppText>
      <TextInput
        testID="report-details"
        accessibilityLabel={t('report.detailsLabel')}
        value={details}
        onChangeText={setDetails}
        maxLength={DETAILS_MAX}
        multiline
        style={{
          minHeight: 96,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          color: colors.text,
          fontSize: fontSize.md,
          textAlign: 'auto',
          textAlignVertical: 'top',
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <AppText style={{ flex: 1 }}>{t('report.alsoBlock')}</AppText>
        <Switch
          testID="report-also-block"
          accessibilityLabel={t('report.alsoBlock')}
          value={alsoBlock}
          onValueChange={setAlsoBlock}
        />
      </View>
      {error ? (
        <AppText testID="report-error" style={{ color: colors.danger }}>
          {t(`letters.error.${error}`)}
        </AppText>
      ) : null}
      <Button
        testID="report-submit"
        title={t('report.submit')}
        loading={sending}
        disabled={!reason}
        onPress={() => void onSubmit()}
      />
    </ScrollView>
  );
}
