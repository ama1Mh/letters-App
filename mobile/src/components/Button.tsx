import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { useTheme } from '@/core/theme/useTheme';

import { AppText } from './AppText';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  loading?: boolean;
  /** primary: heritage green. seal: burgundy, for the one most important action on a screen
   *  (write, send). secondary: outlined. danger: outlined in the danger colour. */
  variant?: 'primary' | 'seal' | 'secondary' | 'danger';
  testID?: string;
}

export function Button({
  title,
  loading = false,
  variant = 'primary',
  disabled,
  testID,
  ...props
}: ButtonProps) {
  const { colors, spacing, radius } = useTheme();
  const isDisabled = disabled === true || loading;
  const filled = variant === 'primary' || variant === 'seal';
  const fill = variant === 'seal' ? colors.accent : colors.primary;
  const label =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'seal'
        ? colors.onAccent
        : variant === 'danger'
          ? colors.danger
          : colors.text;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={{
        backgroundColor: filled ? fill : 'transparent',
        borderWidth: filled ? 0 : 1.5,
        borderColor: variant === 'danger' ? colors.danger : colors.border,
        borderRadius: radius.sm,
        paddingVertical: spacing.md,
        // Compact buttons (e.g. Accept/Decline in a row) must not hug their label, and every
        // button keeps Android's 48 dp minimum touch target (device QA 2026-10-01).
        paddingHorizontal: spacing.lg,
        minHeight: 48,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: isDisabled ? 0.6 : 1,
      }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={filled ? label : colors.primary} />
      ) : (
        <AppText style={{ color: label, fontWeight: '600' }}>{title}</AppText>
      )}
    </Pressable>
  );
}
