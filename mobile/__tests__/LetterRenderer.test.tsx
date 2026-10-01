import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import {
  LETTER_BODY_SIZE,
  LetterRenderer,
  letterTextSize,
} from '@/features/designs/LetterRenderer';
import { DESIGN_CATALOG, defaultDesign } from '@/domain/design';

function styleOf(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style);
}

describe('LetterRenderer', () => {
  it('renders the paper background, ink text color, subject and body', async () => {
    const design = { ...defaultDesign(), paper: 'sky', ink: 'navy' };
    await render(
      <LetterRenderer
        testID="letter"
        design={design}
        subject="Hi"
        body="Hello there"
        bodyDir="ltr"
      />,
    );

    expect(styleOf('letter')?.backgroundColor).toBe('#EAF4FC'); // sky
    expect(screen.getByText('Hi')).toBeTruthy();
    expect(screen.getByText('Hello there')).toBeTruthy();
    expect(styleOf('letter-subject')?.color).toBe('#1E3A8A'); // navy
    expect(styleOf('letter-body')?.color).toBe('#1E3A8A');
  });

  it('aligns and sets writingDirection from bodyDir, not the design or the UI', async () => {
    const design = defaultDesign();
    await render(<LetterRenderer testID="letter" design={design} body="مرحبا" bodyDir="rtl" />);

    const style = styleOf('letter-body');
    expect(style?.textAlign).toBe('right');
    expect(style?.writingDirection).toBe('rtl');
  });

  it('omits the subject line entirely when there is none', async () => {
    await render(
      <LetterRenderer testID="letter" design={defaultDesign()} body="Hi" bodyDir="ltr" />,
    );
    expect(screen.queryByTestId('letter-subject')).toBeNull();
  });

  it("uses the chosen font when it supports the letter's script", async () => {
    const design = { ...defaultDesign(), font: 'amiri' };
    await render(<LetterRenderer testID="letter" design={design} body="Hi" bodyDir="ltr" />);
    expect(styleOf('letter-body')?.fontFamily).toBe('Amiri_400Regular');
  });

  it('falls back to the script fallback font when the chosen font cannot render it (PLAN §3.4)', async () => {
    const design = { ...defaultDesign(), font: 'caveat' }; // caveat: latin-only
    await render(<LetterRenderer testID="letter" design={design} body="مرحبا" bodyDir="rtl" />);
    const fallbackFamily = DESIGN_CATALOG.fonts.find(
      (f) => f.key === DESIGN_CATALOG.fallbackFonts.arabic,
    )?.family;
    expect(styleOf('letter-body')?.fontFamily).toBe(fallbackFamily);
    expect(styleOf('letter-body')?.fontFamily).not.toBe('Caveat_400Regular');
  });

  it('renders the stamp icon only when the design has one', async () => {
    await render(
      <LetterRenderer
        testID="letter"
        design={{ ...defaultDesign(), stamp: 'heart' }}
        body="Hi"
        bodyDir="ltr"
      />,
    );
    expect(screen.getByTestId('letter-stamp')).toBeTruthy();
  });

  it('renders no stamp view when the design has none', async () => {
    await render(
      <LetterRenderer
        testID="letter"
        design={{ ...defaultDesign(), stamp: null }}
        body="Hi"
        bodyDir="ltr"
      />,
    );
    expect(screen.queryByTestId('letter-stamp')).toBeNull();
  });
});

describe('LetterRenderer text size (Phase 10 font scaling)', () => {
  it('enlarges small-x-height handwriting fonts and keeps line height proportional', async () => {
    await render(
      <LetterRenderer
        testID="letter"
        design={{ ...defaultDesign(), font: 'caveat' }}
        body="Hi"
        bodyDir="ltr"
      />,
    );
    const caveat = styleOf('letter-body');
    expect(caveat?.fontSize).toBe(letterTextSize('caveat', LETTER_BODY_SIZE).fontSize);
    expect(caveat?.fontSize).toBeGreaterThan(LETTER_BODY_SIZE);
    expect(caveat?.lineHeight).toBeGreaterThan(caveat?.fontSize as number);
  });

  it('never opts out of the system font scale', async () => {
    await render(
      <LetterRenderer
        testID="letter"
        design={defaultDesign()}
        subject="S"
        body="B"
        bodyDir="ltr"
      />,
    );
    expect(screen.getByTestId('letter-body').props.allowFontScaling).not.toBe(false);
    expect(screen.getByTestId('letter-subject').props.maxFontSizeMultiplier).toBeUndefined();
  });
});
