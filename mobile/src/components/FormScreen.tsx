import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';

import { useTheme } from '@/core/theme/useTheme';

interface FormScreenProps {
  testID: string;
  children: ReactNode;
}

/**
 * A full screen holding a form: content centred while it fits, scrollable when it does not, and
 * lifted above the soft keyboard. The app draws edge to edge, so Android does not shrink the
 * window for the keyboard; without this the lower fields (onboarding's display name) sat under it
 * (owner, phone QA 2026-10-04). Taps on buttons work while the keyboard is open.
 */
export function FormScreen({ testID, children }: FormScreenProps) {
  const { colors, spacing } = useTheme();
  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        testID={testID}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
