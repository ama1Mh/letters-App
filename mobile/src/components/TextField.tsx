import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/core/theme/useTheme';

import { AppText } from './AppText';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  testID?: string;
}

/** Labeled input with an optional error line. Alignment is `'auto'` (content direction), never a
 *  physical left/right, matching how plain `TextInput` already behaves (OPEN-4 spike finding). */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, testID, style, ...props },
  ref,
) {
  const { colors, spacing, radius, fontSize } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="muted">{label}</AppText>
      <TextInput
        ref={ref}
        testID={testID}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[
          {
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            fontSize: fontSize.md,
            color: colors.text,
            textAlign: 'auto',
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <AppText testID={testID ? `${testID}-error` : undefined} style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
});
