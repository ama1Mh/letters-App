import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { isLayoutRtl } from '@/core/i18n/direction';

type IconProps = ComponentProps<typeof Ionicons>;

/**
 * Use for icons whose meaning depends on reading direction (chevrons, back/forward arrows, send).
 * Mirrors the glyph horizontally in RTL layouts. Non-directional icons (mail, person, ...) should
 * use the plain icon component instead.
 */
export function DirectionalIcon({ style, ...props }: IconProps) {
  return <Ionicons {...props} style={[style, isLayoutRtl() && { transform: [{ scaleX: -1 }] }]} />;
}
