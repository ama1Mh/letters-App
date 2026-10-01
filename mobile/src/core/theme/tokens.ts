/** Design tokens. Layout values are direction-neutral; use start/end when applying them. */

export interface ColorTokens {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  danger: string;
}

export const lightColors: ColorTokens = {
  background: '#FFFFFF',
  surface: '#F4F5F7',
  text: '#111827',
  textMuted: '#5B6472',
  border: '#D9DCE1',
  primary: '#1D4ED8',
  onPrimary: '#FFFFFF',
  danger: '#B91C1C', // 4.5:1 or better on background and surface (WCAG AA, Phase 10)
};

export const darkColors: ColorTokens = {
  background: '#0B0F17',
  surface: '#161B26',
  text: '#F3F4F6',
  textMuted: '#9AA3B2',
  border: '#2A3140',
  primary: '#7AA2FF',
  onPrimary: '#0B0F17',
  danger: '#F87171',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Android's minimum touch target (48 dp). Rows use it as minHeight; small swatches reach it
 *  with `hitSlopTo()` instead, so they keep their size (Phase 10 accessibility pass). */
export const MIN_TOUCH_TARGET = 48;

/** Inline text links (one line of text, ~18-22 dp tall) reach 48 dp without moving any text.
 *  One number = the same on every side, so it is direction-neutral (LTR and RTL). */
export const TEXT_LINK_HIT_SLOP = 15;

/** Equal hitSlop on every side that grows a `size` x `size` control to MIN_TOUCH_TARGET. */
export function hitSlopTo(size: number): number {
  return Math.max(0, Math.ceil((MIN_TOUCH_TARGET - size) / 2));
}
export const radius = { sm: 6, md: 10, lg: 16 } as const;
export const fontSize = { sm: 13, md: 16, lg: 20, xl: 28 } as const;

export type ColorScheme = 'light' | 'dark';
export const colorsByScheme: Record<ColorScheme, ColorTokens> = {
  light: lightColors,
  dark: darkColors,
};
