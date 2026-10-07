import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { initI18n } from '@/core/i18n';
import { DESIGN_CATALOG, defaultDesign, type DesignElement } from '@/domain/design';
import {
  CANVAS_MIN_ASPECT,
  CANVAS_WIDTH,
  LetterCanvas,
  elementBox,
  letterTextSize,
  postmarkDateText,
  sheetHeight,
} from '@/features/designs/LetterCanvas';

beforeAll(() => {
  initI18n();
});

function styleOf(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style);
}

function transformOf(testID: string): Record<string, unknown> {
  return Object.assign({}, ...(styleOf(testID)?.transform ?? [])) as Record<string, unknown>;
}

const STAMP: DesignElement = {
  id: 'a1stamp1',
  type: 'stamp',
  asset: 'stamp_dove',
  x: 0.82,
  y: 0.14,
  scale: 1,
  rotation: -6,
  z: 1,
};
const POSTMARK: DesignElement = {
  id: 'c3post01',
  type: 'postmark',
  asset: 'postmark_round',
  x: 0.6,
  y: 0.3,
  scale: 1.5,
  rotation: 10,
  z: 0,
};

describe('LetterCanvas', () => {
  it('renders the paper colour, ink, subject and body', async () => {
    const design = { ...defaultDesign(), paper: 'parchment', ink: 'faded_blue' };
    await render(
      <LetterCanvas
        testID="letter"
        design={design}
        subject="Hi"
        body="Hello there"
        bodyDir="ltr"
      />,
    );
    expect(styleOf('letter')?.backgroundColor).toBe('#E9D8B0');
    expect(screen.getByText('Hi')).toBeTruthy();
    expect(screen.getByText('Hello there')).toBeTruthy();
    expect(styleOf('letter-subject')?.color).toBe('#3E5A7E');
    expect(styleOf('letter-body')?.color).toBe('#3E5A7E');
  });

  it('is a left-to-right physical sheet; text follows bodyDir with physical alignment', async () => {
    await render(
      <LetterCanvas testID="letter" design={defaultDesign()} body="مرحبا" bodyDir="rtl" />,
    );
    expect(styleOf('letter')?.direction).toBe('ltr');
    expect(styleOf('letter-body')).toMatchObject({ textAlign: 'right', writingDirection: 'rtl' });
  });

  it('scales the 360 dp sheet to the given width, keeping the A-paper minimum height', async () => {
    await render(
      <LetterCanvas testID="letter" design={defaultDesign()} body="Hi" bodyDir="ltr" width={180} />,
    );
    expect(styleOf('letter')?.width).toBe(180);
    expect(styleOf('letter')?.height).toBe(Math.ceil(CANVAS_WIDTH * CANVAS_MIN_ASPECT) / 2);
  });

  it('uses the chosen font when it supports the script, else the script fallback', async () => {
    await render(
      <LetterCanvas
        testID="a"
        design={{ ...defaultDesign(), font: 'aref_ruqaa' }}
        body="مرحبا"
        bodyDir="rtl"
      />,
    );
    expect(styleOf('a-body')?.fontFamily).toBe('ArefRuqaa_400Regular');
    await render(
      <LetterCanvas
        testID="b"
        design={{ ...defaultDesign(), font: 'caveat' }}
        body="مرحبا"
        bodyDir="rtl"
      />,
    );
    const fallback = DESIGN_CATALOG.fonts.find(
      (f) => f.key === DESIGN_CATALOG.fallbackFonts.arabic,
    );
    expect(styleOf('b-body')?.fontFamily).toBe(fallback?.family);
  });

  it("sizes the body from the design's text size (S / M / L)", async () => {
    const sizes: Record<string, number> = {};
    for (const textSize of ['s', 'm', 'l'] as const) {
      await render(
        <LetterCanvas
          testID={`l-${textSize}`}
          design={{ ...defaultDesign(), font: 'amiri', textSize }}
          body="Hi"
          bodyDir="ltr"
        />,
      );
      sizes[textSize] = styleOf(`l-${textSize}-body`)?.fontSize as number;
    }
    expect(sizes.s).toBeLessThan(sizes.m);
    expect(sizes.m).toBeLessThan(sizes.l);
  });

  it('keeps the composition fixed: sheet text ignores the system font scale (DEC-061)', async () => {
    await render(
      <LetterCanvas testID="letter" design={defaultDesign()} subject="S" body="B" bodyDir="ltr" />,
    );
    expect(screen.getByTestId('letter-body').props.allowFontScaling).toBe(false);
    expect(screen.getByTestId('letter-subject').props.allowFontScaling).toBe(false);
  });

  it('places elements by their model in logical units, in paint order, with accessible names', async () => {
    const design = { ...defaultDesign(), elements: [STAMP, POSTMARK] };
    await render(
      <LetterCanvas
        testID="letter"
        design={design}
        body="Hi"
        bodyDir="ltr"
        postmarkDate={new Date('2026-10-01T12:00:00Z')}
      />,
    );
    const box = elementBox(STAMP);
    expect(transformOf('letter-element-a1stamp1')).toMatchObject({
      translateX: STAMP.x * CANVAS_WIDTH - box.width / 2,
      translateY: STAMP.y * CANVAS_WIDTH - box.height / 2,
      rotate: '-6deg',
    });
    expect(styleOf('letter-element-a1stamp1')).toMatchObject({
      width: box.width,
      height: box.height,
    });
    expect(screen.getByLabelText('Dove stamp')).toBeTruthy();
    // The dated postmark carries the letter's date, in its own label too.
    expect(screen.getByText('OCT 1, 2026')).toBeTruthy();
    expect(screen.getByLabelText('Dated postmark, OCT 1, 2026')).toBeTruthy();
    // Paint order follows z: the postmark (z 0) comes before the stamp (z 1).
    const ids = screen.getAllByTestId(/letter-element-/).map((n) => n.props.testID);
    expect(ids).toEqual(['letter-element-c3post01', 'letter-element-a1stamp1']);
  });
});

describe('sheet geometry helpers', () => {
  it('letterTextSize enlarges small-x-height fonts and keeps line height proportional', () => {
    expect(letterTextSize('caveat', 18).fontSize).toBeGreaterThan(18);
    expect(letterTextSize('cairo', 18)).toEqual({ fontSize: 18, lineHeight: 29 });
  });

  it('sheetHeight grows with the text and with elements placed further down', () => {
    const min = Math.ceil(CANVAS_WIDTH * CANVAS_MIN_ASPECT);
    expect(sheetHeight(0, [])).toBe(min);
    expect(sheetHeight(1000, [])).toBe(1000 + 56);
    expect(sheetHeight(0, [{ ...STAMP, y: 5 }])).toBeGreaterThan(5 * CANVAS_WIDTH);
  });

  it('postmarkDateText follows the letter language with Western digits', () => {
    const date = new Date('2026-10-01T12:00:00Z');
    expect(postmarkDateText(date, 'ltr')).toBe('OCT 1, 2026');
    expect(postmarkDateText(date, 'rtl')).toMatch(/1.*2026/);
    expect(postmarkDateText(date, 'rtl')).not.toMatch(/[٠-٩]/);
  });
});
