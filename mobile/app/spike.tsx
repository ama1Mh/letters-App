// TEMPORARY (Phase 1 spike, OPEN-4): open with `adb shell am start -a android.intent.action.VIEW
// -d letterapp://spike com.letterapp.dev`. Not linked from the app; delete this file and
// src/features/spike/ once the findings are recorded in docs/DECISIONS.md.
import { getCalendars, getLocales } from 'expo-localization';
import { Redirect, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { reloadApp } from '@/core/i18n/direction';
import { useTheme } from '@/core/theme/useTheme';
import {
  firstStrongDirection,
  probePlurals,
  probeIntl,
  formatIntlSupport,
} from '@/features/spike/intlProbe';
import {
  FONT_FAMILIES,
  FONT_WEIGHTS,
  LABELS,
  LRI,
  MIXED_LINES,
  PLURAL_LOCALES,
  PDI,
  SAMPLE_ARABIC,
  SAMPLE_LATIN,
  SAMPLE_MIXED,
} from '@/features/spike/samples';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        gap: spacing.sm,
        paddingBottom: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <AppText variant="title">{title}</AppText>
      {children}
    </View>
  );
}

function Button({ text, onPress, testID }: { text: string; onPress: () => void; testID: string }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <AppText>{text}</AppText>
    </Pressable>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <Text selectable style={{ fontFamily: 'monospace', fontSize: 12 }}>
      {children}
    </Text>
  );
}

function RuntimeSection() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const { spacing } = useTheme();
  const locale = getLocales()[0];
  const calendar = getCalendars()[0];
  const constants = I18nManager.getConstants();
  const lines = [
    `i18n.language: ${i18n.language}`,
    `I18nManager.isRTL: ${String(constants.isRTL)}`,
    `doLeftAndRightSwapInRTL: ${String(constants.doLeftAndRightSwapInRTL)}`,
    `device languageTag: ${locale?.languageTag} (${locale?.textDirection})`,
    `device locales: ${getLocales()
      .map((item) => item.languageTag)
      .join(', ')}`,
    `Intl default locale: ${new Intl.DateTimeFormat().resolvedOptions().locale}`,
    `device digits: decimal '${locale?.decimalSeparator}' group '${locale?.digitGroupingSeparator}'`,
    `device calendar: ${calendar?.calendar} tz ${calendar?.timeZone}`,
    `platform: ${Platform.OS} ${String(Platform.Version)}`,
  ];
  return (
    <Section title={LABELS.runtime}>
      {lines.map((line) => (
        <Mono key={line}>{line}</Mono>
      ))}
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button
          testID="spike-open-language"
          text={LABELS.openLanguage}
          onPress={() => router.push('/settings/language')}
        />
        <Button testID="spike-reload" text={LABELS.reloadNow} onPress={reloadApp} />
      </View>
    </Section>
  );
}

function BidiInputSection() {
  const { colors, spacing, radius, fontSize } = useTheme();
  const [text, setText] = useState('');
  const inputStyle = {
    minHeight: 96,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: fontSize.md,
    textAlignVertical: 'top' as const,
  };
  return (
    <Section title={LABELS.input}>
      <AppText variant="muted">{LABELS.inputHint}</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button
          testID="spike-fill-ar"
          text={LABELS.fillArabic}
          onPress={() => setText(SAMPLE_ARABIC)}
        />
        <Button
          testID="spike-fill-en"
          text={LABELS.fillLatin}
          onPress={() => setText(SAMPLE_LATIN)}
        />
        <Button
          testID="spike-fill-mixed"
          text={LABELS.fillMixed}
          onPress={() => setText(SAMPLE_MIXED)}
        />
        <Button testID="spike-fill-clear" text={LABELS.fillClear} onPress={() => setText('')} />
      </View>
      <AppText variant="muted">{LABELS.inputDefault}</AppText>
      <TextInput
        testID="spike-input-default"
        multiline
        value={text}
        onChangeText={setText}
        style={inputStyle}
      />
      <AppText variant="muted">{LABELS.inputAuto}</AppText>
      <TextInput
        testID="spike-input-auto"
        multiline
        value={text}
        onChangeText={setText}
        style={[inputStyle, { textAlign: 'auto' }]}
      />
      <Mono>{`${LABELS.firstStrong}: ${String(firstStrongDirection(text))} · length ${text.length}`}</Mono>
    </Section>
  );
}

function MixedSection() {
  const { colors, spacing, radius } = useTheme();
  const box = {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  };
  return (
    <Section title={LABELS.mixed}>
      {MIXED_LINES.map((line) => (
        <View key={line.key} style={{ gap: spacing.xs }}>
          <AppText variant="muted">{`${line.key} — ${LABELS.mixedPlain}`}</AppText>
          <View style={box}>
            <AppText>{`${line.before}${line.username}${line.after}`}</AppText>
          </View>
          <AppText variant="muted">{`${line.key} — ${LABELS.mixedIsolated}`}</AppText>
          <View style={box}>
            <AppText>{`${line.before}${LRI}${line.username}${PDI}${line.after}`}</AppText>
          </View>
        </View>
      ))}
    </Section>
  );
}

function FontsSection() {
  const { colors, spacing } = useTheme();
  return (
    <Section title={LABELS.fonts}>
      {FONT_FAMILIES.map((family) => (
        <View key={family} style={{ gap: spacing.xs }}>
          <Mono>{family}</Mono>
          {FONT_WEIGHTS.map((weight) => (
            <Text
              key={weight}
              style={{ fontFamily: family, fontWeight: weight, fontSize: 18, color: colors.text }}
            >
              {`${weight} · ${SAMPLE_ARABIC}`}
            </Text>
          ))}
        </View>
      ))}
    </Section>
  );
}

function IntlSection() {
  const { spacing } = useTheme();
  const rows = probeIntl();
  const plurals = { ar: probePlurals('ar'), en: probePlurals('en') };
  return (
    <Section title={LABELS.intl}>
      <AppText variant="muted">{LABELS.intlBare}</AppText>
      {rows.map((row) => (
        <View key={row.label} style={{ gap: spacing.xs }}>
          <Mono>{row.label}</Mono>
          <Mono>{`  ${row.date}`}</Mono>
          <Mono>{`  ${row.number}`}</Mono>
          <Mono>{`  calendar=${row.calendar} numbering=${row.numberingSystem}`}</Mono>
        </View>
      ))}
      <AppText variant="title">{LABELS.support}</AppText>
      <Mono>{formatIntlSupport()}</Mono>
      <AppText variant="title">{LABELS.plurals}</AppText>
      {PLURAL_LOCALES.map((locale) => (
        <Mono key={locale}>
          {plurals[locale]
            ? locale +
              ' ' +
              plurals[locale].map(({ count, category }) => count + ':' + category).join('  ')
            : locale + ' ' + LABELS.pluralsMissing}
        </Mono>
      ))}
      <AppText variant="muted">{LABELS.datePicker}</AppText>
    </Section>
  );
}

export default function SpikeScreen() {
  const { colors, spacing } = useTheme();
  if (!__DEV__) return <Redirect href="/inbox" />;
  return (
    <ScrollView
      testID="spike-screen"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <AppText variant="muted">{LABELS.dev}</AppText>
      <RuntimeSection />
      <BidiInputSection />
      <MixedSection />
      <FontsSection />
      <IntlSection />
    </ScrollView>
  );
}
