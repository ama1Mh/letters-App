import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { currentBrand } from '@/core/config/brand';
import { INTL_LOCALES, isLanguage, DEFAULT_LANGUAGE } from '@/core/i18n/languages';
import { useTheme } from '@/core/theme/useTheme';
import {
  PRIVACY_POLICY,
  PRIVACY_POLICY_UPDATED,
  fillPolicyText,
} from '@/features/legal/privacyPolicy';

/** The privacy policy (DEC-053), in the UI language. Reachable signed in (Profile) and signed out
 *  (Sign up), so it lives outside both route groups. The email is shown as plain LTR text. */
export default function PrivacyPolicyScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const language = isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
  const doc = PRIVACY_POLICY[language];
  const date = new Intl.DateTimeFormat(INTL_LOCALES[language], {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${PRIVACY_POLICY_UPDATED}T00:00:00Z`));
  // U+2066 LRI ... U+2069 PDI keep the address in LTR order inside Arabic sentences.
  const values = {
    appName: t('app.name'),
    email: `⁦${currentBrand().privacyContactEmail}⁩`,
    date,
  };
  const fill = (text: string) => fillPolicyText(text, values);

  return (
    <ScrollView
      testID="privacy-policy-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
    >
      <AppText variant="muted">{fill(doc.updatedLabel)}</AppText>
      {doc.sections.map((section) => (
        <View key={section.heading} style={{ gap: spacing.sm }}>
          <AppText variant="title" accessibilityRole="header">
            {section.heading}
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
