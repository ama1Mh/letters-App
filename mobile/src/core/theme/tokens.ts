/** Design tokens. Layout values are direction-neutral; use start/end when applying them. */

/**
 * Mirsal palette B, "Heritage Green & Wax" (owner choice 2026-10-03, DEC-063): aged cream and ivory
 * paper, ink-brown text, sepia secondary text, heritage green for main actions, a burgundy wax-seal
 * accent used sparingly (writing/sending, unread), postal blue for links. Every foreground token is
 * at least 4.5:1 on background and surface in both themes (theme-contrast.test.ts).
 */
export interface ColorTokens {
  /** Page ground: aged cream / night green-black. */
  background: string;
  /** Cards, inputs, bars: ivory / raised night. */
  surface: string;
  /** Ink. */
  text: string;
  /** Sepia: secondary text, captions, inactive icons. */
  textMuted: string;
  border: string;
  /** Heritage green: main actions, active navigation. */
  primary: string;
  onPrimary: string;
  /** Burgundy wax seal: the one most important action on a screen (write, send) and unread marks. */
  accent: string;
  onAccent: string;
  /** Faded postal blue: inline links. */
  link: string;
  /** Confirmations (delivered, saved). */
  success: string;
  danger: string;
}

export const lightColors: ColorTokens = {
  background: '#F6F0E3',
  surface: '#FDF9F0',
  text: '#2B231C',
  textMuted: '#685744',
  border: '#DDD0B9',
  primary: '#2F5B48',
  onPrimary: '#FDF9F0',
  accent: '#8A2E3B',
  onAccent: '#FDF9F0',
  link: '#3A5A7C',
  success: '#2F5B48',
  danger: '#9C2B1C',
};

export const darkColors: ColorTokens = {
  background: '#161B17',
  surface: '#1F2620',
  text: '#ECE4D3',
  textMuted: '#B9AB92',
  border: '#36423A',
  primary: '#8FC0A6',
  onPrimary: '#161B17',
  accent: '#E08A97',
  onAccent: '#161B17',
  link: '#A3BFDC',
  success: '#8FC0A6',
  danger: '#F2917F',
};

/**
 * Typography (DEC-063): Amiri for titles and display text in both scripts (it has Latin and Arabic),
 * the platform sans for body and controls (readable at every font scale). Families are loaded once
 * by useDesignFonts; until then React Native falls back to the system font.
 */
export const fonts = {
  display: 'Amiri_700Bold',
  displayRegular: 'Amiri_400Regular',
} as const;

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
