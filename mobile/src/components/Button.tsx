import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { useTheme } from '@/core/theme/useTheme';

import { AppText } from './AppText';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
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
  const isPrimary = variant === 'primary';
  const isDisabled = disabled === true || loading;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={{
        backgroundColor: isPrimary ? colors.primary : 'transparent',
        borderWidth: isPrimary ? 0 : 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        paddingVertical: spacing.md,
        alignItems: 'center',
        opacity: isDisabled ? 0.6 : 1,
      }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.onPrimary : colors.primary} />
      ) : (
        <AppText style={{ color: isPrimary ? colors.onPrimary : colors.text, fontWeight: '600' }}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}
