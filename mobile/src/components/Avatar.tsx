import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/core/theme/useTheme';
import { avatarPreset, type AvatarSource } from '@/domain/avatar';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * A person's avatar (DEC-011): one component for every avatar kind. Presets draw their catalog
 * glyph on its colour; no avatar (null, or an unknown key) draws a neutral person glyph. The
 * `image` variant is reserved for a later version and currently falls back to the neutral glyph.
 * Decorative: the name next to it is what screen readers read.
 */
export function Avatar({
  source,
  size = 36,
  testID,
}: {
  source: AvatarSource | null;
  size?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  const preset = source?.type === 'preset' ? avatarPreset(source.key) : null;
  const background = preset?.color ?? colors.surface;
  const icon = (preset?.icon ?? 'person') as IconName;
  return (
    <View
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={size * 0.55} color={preset ? '#FFFFFF' : colors.textMuted} />
    </View>
  );
}
