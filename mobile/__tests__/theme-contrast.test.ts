import { darkColors, lightColors, type ColorTokens } from '@/core/theme/tokens';

/** WCAG 2.x relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as [string, ColorTokens][])('%s theme contrast (WCAG AA, Phase 10)', (_name, colors) => {
  it.each(['text', 'textMuted', 'primary', 'danger'] as const)(
    '%s is at least 4.5:1 on background and surface',
    (token) => {
      expect(contrast(colors[token], colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors[token], colors.surface)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('onPrimary is at least 4.5:1 on primary (button labels)', () => {
    expect(contrast(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
  });
});
