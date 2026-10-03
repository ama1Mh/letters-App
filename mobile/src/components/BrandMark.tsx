import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useTheme } from '@/core/theme/useTheme';

import { BRAND_WORDMARK } from '../../brand.config';
import { AppText } from './AppText';

/**
 * The Mirsal wordmark (Phase 13, DEC-063): مرسال in Amiri over MIRSAL in spaced capitals, joined by a
 * burgundy rule. Both scripts always appear, whatever the UI language, with equal weight. TalkBack
 * reads the name once, in the UI language. The icon mark joins it once the logo concept is chosen.
 */
export function BrandMark({
  size = 'large',
  testID,
}: {
  size?: 'large' | 'small';
  testID?: string;
}) {
  const { t } = useTranslation();
  const { colors, fonts, spacing } = useTheme();
  const big = size === 'large';
  const arabicSize = big ? 52 : 30;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="header"
      accessibilityLabel={t('app.name')}
      style={{ alignItems: 'center', gap: big ? spacing.xs : 2, alignSelf: 'center' }}
    >
      <AppText
        allowFontScaling={false}
        style={{
          fontFamily: fonts.display,
          fontSize: arabicSize,
          lineHeight: Math.round(arabicSize * 1.45),
          color: colors.text,
        }}
      >
        {BRAND_WORDMARK.arabic}
      </AppText>
      <View style={{ width: big ? 120 : 70, height: 2, backgroundColor: colors.accent }} />
      <AppText
        allowFontScaling={false}
        style={{
          fontFamily: fonts.displayRegular,
          fontSize: big ? 20 : 13,
          letterSpacing: big ? 8 : 5,
          color: colors.primary,
          textTransform: 'uppercase',
        }}
      >
        {BRAND_WORDMARK.latin}
      </AppText>
    </View>
  );
}
