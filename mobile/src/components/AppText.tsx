import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/core/theme/useTheme';

type Variant = 'body' | 'title' | 'display' | 'muted';

interface AppTextProps extends TextProps {
  variant?: Variant;
}

/**
 * Themed text. Alignment is left to the platform (natural/start), never physical left/right.
 * `title` and `display` use the Mirsal display face (Amiri, both scripts; DEC-063); Amiri's tall
 * Arabic forms need a generous line height or they clip.
 */
export function AppText({ variant = 'body', style, ...props }: AppTextProps) {
  const { colors, fontSize, fonts } = useTheme();
  const variantStyle = {
    body: { color: colors.text, fontSize: fontSize.md },
    title: {
      color: colors.text,
      fontSize: fontSize.lg + 2,
      lineHeight: Math.round((fontSize.lg + 2) * 1.5),
      fontFamily: fonts.display,
    },
    display: {
      color: colors.text,
      fontSize: fontSize.xl + 4,
      lineHeight: Math.round((fontSize.xl + 4) * 1.4),
      fontFamily: fonts.display,
    },
    muted: { color: colors.textMuted, fontSize: fontSize.sm },
  }[variant];
  return <Text {...props} style={[variantStyle, style]} />;
}
