/** Design tokens. Layout values are direction-neutral; use start/end when applying them. */

export interface ColorTokens {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
}

export const lightColors: ColorTokens = {
  background: '#FFFFFF',
  surface: '#F4F5F7',
  text: '#111827',
  textMuted: '#5B6472',
  border: '#D9DCE1',
  primary: '#1D4ED8',
  onPrimary: '#FFFFFF',
};

export const darkColors: ColorTokens = {
  background: '#0B0F17',
  surface: '#161B26',
  text: '#F3F4F6',
  textMuted: '#9AA3B2',
  border: '#2A3140',
  primary: '#7AA2FF',
  onPrimary: '#0B0F17',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 16 } as const;
export const fontSize = { sm: 13, md: 16, lg: 20, xl: 28 } as const;

export type ColorScheme = 'light' | 'dark';
export const colorsByScheme: Record<ColorScheme, ColorTokens> = {
  light: lightColors,
  dark: darkColors,
};
