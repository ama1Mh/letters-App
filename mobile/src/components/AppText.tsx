import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/core/theme/useTheme';

type Variant = 'body' | 'title' | 'muted';

interface AppTextProps extends TextProps {
  variant?: Variant;
}

/** Themed text. Alignment is left to the platform (natural/start), never physical left/right. */
export function AppText({ variant = 'body', style, ...props }: AppTextProps) {
  const { colors, fontSize } = useTheme();
  const variantStyle = {
    body: { color: colors.text, fontSize: fontSize.md },
    title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '600' as const },
    muted: { color: colors.textMuted, fontSize: fontSize.sm },
  }[variant];
  return <Text {...props} style={[variantStyle, style]} />;
}
