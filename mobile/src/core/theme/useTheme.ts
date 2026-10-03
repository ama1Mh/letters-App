import { useColorScheme } from 'react-native';

import { colorsByScheme, fonts, fontSize, radius, spacing, type ColorTokens } from './tokens';

export interface Theme {
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fonts: typeof fonts;
}

export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { colors: colorsByScheme[scheme], spacing, radius, fontSize, fonts };
}
