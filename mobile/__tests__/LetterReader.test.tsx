import { fireEvent, render, screen } from '@testing-library/react-native';
import Storage from 'expo-sqlite/kv-store';
import { StyleSheet } from 'react-native';

import { initI18n } from '@/core/i18n';
import { defaultDesign, type Design } from '@/domain/design';
import { LetterReader } from '@/features/letters/LetterReader';

beforeAll(() => {
  initI18n();
});

beforeEach(() => {
  Storage.removeItemSync('reader.mode');
});

const DESIGN: Design = {
  ...defaultDesign(),
  elements: [
    {
      id: 'a1stamp1',
      type: 'stamp',
      asset: 'stamp_dove',
      x: 0.8,
      y: 0.2,
      scale: 1,
      rotation: 0,
      z: 0,
    },
    {
      id: 'c3post01',
      type: 'postmark',
      asset: 'postmark_round',
      x: 0.6,
      y: 0.3,
      scale: 1,
      rotation: 0,
      z: 1,
    },
  ],
};

function renderReader() {
  return render(
    <LetterReader
      testID="reader"
      design={DESIGN}
      subject="Hello"
      body="Dear Sara"
      bodyDir="ltr"
      postmarkDate={new Date('2026-10-01T12:00:00Z')}
    />,
  );
}

describe('LetterReader', () => {
  it('shows the designed sheet by default, with zoom limited to its steps', async () => {
    await renderReader();
    expect(screen.getByTestId('reader')).toBeTruthy();
    const out = screen.getByTestId('reader-zoom-out');
    expect(out.props.accessibilityState).toMatchObject({ disabled: true });
    const width = () =>
      StyleSheet.flatten(screen.getByTestId('reader').props.style).width as number;
    const base = width();
    await fireEvent.press(screen.getByTestId('reader-zoom-in'));
    expect(width()).toBeCloseTo(base * 1.5);
    await fireEvent.press(screen.getByTestId('reader-zoom-in'));
    expect(width()).toBeCloseTo(base * 2);
    expect(screen.getByTestId('reader-zoom-in').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await fireEvent.press(screen.getByTestId('reader-zoom-out'));
    expect(width()).toBeCloseTo(base * 1.5);
  });

  it('switches to plain text that follows the font scale, lists the decorations, and remembers it', async () => {
    await renderReader();
    await fireEvent.press(screen.getByTestId('reader-mode'));

    expect(screen.queryByTestId('reader')).toBeNull();
    expect(screen.getByTestId('reader-plain')).toBeTruthy();
    const body = screen.getByText('Dear Sara');
    expect(body.props.allowFontScaling).not.toBe(false);
    expect(screen.getByText('Decorations: Dove stamp, Dated postmark (OCT 1, 2026)')).toBeTruthy();
    expect(screen.queryByTestId('reader-zoom-in')).toBeNull();
    expect(Storage.getItemSync('reader.mode')).toBe('plain');

    // A new reader on this device opens in plain text.
    await renderReader();
    expect(screen.getAllByTestId('reader-plain').length).toBeGreaterThan(0);
  });

  it('switches back to the designed letter', async () => {
    Storage.setItemSync('reader.mode', 'plain');
    await renderReader();
    expect(screen.getByText('Show the designed letter')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reader-mode'));
    expect(screen.getByTestId('reader')).toBeTruthy();
    expect(Storage.getItemSync('reader.mode')).toBe('designed');
  });
});
