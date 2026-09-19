import { View } from 'react-native';

import { useTheme } from '@/core/theme/useTheme';

import { AppText } from './AppText';

interface EmptyStateProps {
  title: string;
  body: string;
  testID?: string;
}

export function EmptyState({ title, body, testID }: EmptyStateProps) {
  const { colors, spacing } = useTheme();
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.sm,
        backgroundColor: colors.background,
      }}
    >
      <AppText variant="title">{title}</AppText>
      <AppText variant="muted" style={{ textAlign: 'center' }}>
        {body}
      </AppText>
    </View>
  );
}
