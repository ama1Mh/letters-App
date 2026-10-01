import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { currentBrand } from '@/core/config/brand';
import { DEFAULT_LANGUAGE, INTL_LOCALES, isLanguage } from '@/core/i18n/languages';
import { useTheme } from '@/core/theme/useTheme';

import { fillLegalText, type LegalDocument } from './document';

/** Renders a legal document (DEC-053/054) in the UI language. */
export function LegalDocumentView({
  document,
  testID,
}: {
  document: LegalDocument;
  testID: string;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const language = isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
  const { updatedLabel, sections } = document.content[language];
  const date = new Intl.DateTimeFormat(INTL_LOCALES[language], {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${document.updated}T00:00:00Z`));
  // U+2066 LRI ... U+2069 PDI keep the address in LTR order inside Arabic sentences.
  const values = {
    appName: t('app.name'),
    email: `⁦${currentBrand().contactEmail}⁩`,
    operator: `⁦${currentBrand().operatorName}⁩`,
    date,
  };
  const fill = (text: string) => fillLegalText(text, values);

  return (
    <ScrollView
      testID={testID}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
    >
      {document.legalReviewed ? null : (
        <AppText testID={`${testID}-draft-notice`} style={{ color: colors.danger }}>
          {t('legal.draftNotice')}
        </AppText>
      )}
      <AppText variant="muted">{fill(updatedLabel)}</AppText>
      {sections.map((section) => (
        <View key={section.heading} style={{ gap: spacing.sm }}>
          <AppText variant="title" accessibilityRole="header">
            {fill(section.heading)}
          </AppText>
          {section.blocks.map((block, index) =>
            block.kind === 'p' ? (
              <AppText key={index}>{fill(block.text)}</AppText>
            ) : (
              <View key={index} style={{ gap: spacing.xs }}>
                {block.items.map((item) => (
                  <View key={item} style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <AppText>{'•'}</AppText>
                    <AppText style={{ flex: 1 }}>{fill(item)}</AppText>
                  </View>
                ))}
              </View>
            ),
          )}
        </View>
      ))}
    </ScrollView>
  );
}
