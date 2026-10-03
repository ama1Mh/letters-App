import { Image, View } from 'react-native';

import { useTheme } from '@/core/theme/useTheme';
import { ELEMENT_IMAGES } from '@/features/designs/designAssets';

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
      {/* A faded postmark: decoration only, never announced (DEC-063). */}
      <Image
        source={ELEMENT_IMAGES.postmark_round}
        accessible={false}
        importantForAccessibility="no"
        resizeMode="contain"
        // Tinted with the sepia token so the ink shows on both cream and the dark ground.
        tintColor={colors.textMuted}
        style={{ width: 96, height: 96, opacity: 0.45, marginBottom: spacing.sm }}
      />
      <AppText variant="title" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      <AppText variant="muted" style={{ textAlign: 'center' }}>
        {body}
      </AppText>
    </View>
  );
}
