import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import type { LocalDraft } from '@/data/local/draftsStore';
import { defaultDesign, designSchema, type Design, type DesignElement } from '@/domain/design';

import { renderShellIn } from './helpers/renderShell';

function draft(overrides: Partial<LocalDraft> = {}): LocalDraft {
  return {
    id: 'draft-desk',
    subject: 'Hi',
    body: 'Hello there',
    bodyDir: 'ltr',
    design: defaultDesign(),
    recipientId: null,
    dirty: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

async function openCompose(language: 'en' | 'ar', initial: LocalDraft) {
  const view = await renderShellIn(language, undefined, [initial]);
  const save = jest.spyOn(view.drafts, 'save');
  // eslint-disable-next-line @typescript-eslint/require-await
  await act(async () => router.push(`/compose/${initial.id}`));
  await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());
  await waitFor(() => expect(screen.getByTestId('compose-body')).toHaveDisplayValue(initial.body));
  return { view, save };
}

function lastSavedDesign(save: jest.SpyInstance): Design {
  const calls = save.mock.calls as [{ design: Design }][];
  return calls[calls.length - 1][0].design;
}

function onlyElement(save: jest.SpyInstance): DesignElement {
  const els = lastSavedDesign(save).elements;
  expect(els).toHaveLength(1);
  return els[0];
}

describe('compose desk (Phase 12.5)', () => {
  it('writes on the paper and changes the paper from the Paper tray', async () => {
    const { save, view } = await openCompose('en', draft());

    expect(screen.getByTestId('compose-subject')).toHaveDisplayValue('Hi');
    expect(
      StyleSheet.flatten(screen.getByTestId('compose-preview').props.style).backgroundColor,
    ).toBe('#EFE2C4');
    // The subject wraps like on the finished letter but stays one line of text.
    await fireEvent.changeText(screen.getByTestId('compose-subject'), 'Two\nlines');
    expect(screen.getByTestId('compose-subject')).toHaveDisplayValue('Two lines');
    // Text on the sheet keeps the composition: no system font scaling (DEC-061).
    expect(screen.getByTestId('compose-body').props.allowFontScaling).toBe(false);

    await fireEvent.press(screen.getByTestId('compose-mode-paper'));
    await fireEvent.press(screen.getByTestId('compose-paper-parchment'));
    await waitFor(() =>
      expect(
        StyleSheet.flatten(screen.getByTestId('compose-preview').props.style).backgroundColor,
      ).toBe('#E9D8B0'),
    );
    await waitFor(() => expect(lastSavedDesign(save).paper).toBe('parchment'));
    expect((await view.drafts.get('draft-desk'))?.design).toMatchObject({ paper: 'parchment' });
  });

  it('sets font, ink and size from the Write tray; an Arabic letter is offered Arabic fonts only', async () => {
    const { save } = await openCompose('en', draft({ body: 'مرحبا يا سارة', bodyDir: 'rtl' }));
    await waitFor(() => expect(screen.queryByTestId('compose-font-caveat')).toBeNull());
    expect(screen.getByTestId('compose-font-aref_ruqaa')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('compose-font-aref_ruqaa'));
    await fireEvent.press(screen.getByTestId('compose-ink-sepia'));
    await fireEvent.press(screen.getByTestId('compose-size-l'));
    await waitFor(() =>
      expect(lastSavedDesign(save)).toMatchObject({
        font: 'aref_ruqaa',
        ink: 'sepia',
        textSize: 'l',
      }),
    );
  });

  it('adds, selects, moves, resizes, rotates, layers, removes and restores a decoration', async () => {
    const { save } = await openCompose('en', draft());
    await fireEvent.press(screen.getByTestId('compose-mode-decorate'));
    expect(screen.getByText(/Tap a decoration on the letter/)).toBeTruthy();

    // Add a stamp: it lands in the English letter's top-right corner and is selected.
    await fireEvent.press(screen.getByLabelText('Add Dove stamp'));
    await waitFor(() => expect(lastSavedDesign(save).elements).toHaveLength(1));
    const added = onlyElement(save);
    expect(added).toMatchObject({ type: 'stamp', asset: 'stamp_dove', x: 0.84, y: 0.16, scale: 1 });
    expect(screen.getByText('Selected: Dove stamp')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Move left'));
    await fireEvent.press(screen.getByLabelText('Move down'));
    await fireEvent.press(screen.getByLabelText('Bigger'));
    await fireEvent.press(screen.getByLabelText('Rotate clockwise'));
    await waitFor(() => expect(onlyElement(save).rotation).toBe(15));
    expect(onlyElement(save)).toMatchObject({ x: 0.82, y: 0.18, scale: 1.15 });

    // A second decoration goes on top; layering swaps them.
    await fireEvent.press(screen.getByTestId('compose-sel-done'));
    await fireEvent.press(screen.getByLabelText('Add Flower sticker'));
    await waitFor(() => expect(lastSavedDesign(save).elements).toHaveLength(2));
    await fireEvent.press(screen.getByLabelText('Send backward'));
    await waitFor(() => {
      const els = lastSavedDesign(save).elements;
      expect(els.find((e) => e.asset === 'sticker_flower')?.z).toBe(0);
    });
    expect(designSchema.safeParse(lastSavedDesign(save)).success).toBe(true);

    // Remove, then undo.
    await fireEvent.press(screen.getByLabelText('Remove'));
    await waitFor(() => expect(lastSavedDesign(save).elements).toHaveLength(1));
    expect(screen.getByText('Flower sticker removed.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('compose-undo'));
    await waitFor(() => expect(lastSavedDesign(save).elements).toHaveLength(2));
    expect(lastSavedDesign(save).elements.find((e) => e.asset === 'sticker_flower')?.z).toBe(0);
  });

  it('selects an existing decoration by tapping it on the letter', async () => {
    const stamp: DesignElement = {
      id: 'a1stamp1',
      type: 'stamp',
      asset: 'stamp_palm',
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      z: 0,
    };
    await openCompose('en', draft({ design: { ...defaultDesign(), elements: [stamp] } }));
    // Outside Decorate mode decorations are not buttons (they never block the text).
    expect(screen.getByTestId('compose-element-a1stamp1').props.accessibilityRole).toBe('image');
    await fireEvent.press(screen.getByTestId('compose-mode-decorate'));
    await fireEvent.press(screen.getByTestId('compose-element-a1stamp1'));
    expect(screen.getByText('Selected: Palm tree stamp')).toBeTruthy();
    expect(screen.getByTestId('compose-element-a1stamp1').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('stops adding at 24 decorations', async () => {
    const elements: DesignElement[] = Array.from({ length: 24 }, (_, i) => ({
      id: `el${String(i).padStart(6, '0')}`,
      type: 'sticker',
      asset: 'sticker_moon',
      x: 0.5,
      y: 1,
      scale: 1,
      rotation: 0,
      z: i,
    }));
    await openCompose('en', draft({ design: { ...defaultDesign(), elements } }));
    await fireEvent.press(screen.getByTestId('compose-mode-decorate'));
    expect(screen.getByText('A letter can hold up to 24 decorations.')).toBeTruthy();
    expect(screen.getByLabelText('Add Dove stamp').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('in the Arabic UI an Arabic letter gets its stamp in the top-left (letter direction, physical)', async () => {
    const { save } = await openCompose('ar', draft({ body: 'مرحبا يا سارة', bodyDir: 'rtl' }));
    await fireEvent.press(screen.getByTestId('compose-mode-decorate'));
    await fireEvent.press(screen.getByTestId('compose-add-stamp_dove'));
    await waitFor(() => expect(lastSavedDesign(save).elements).toHaveLength(1));
    expect(onlyElement(save).x).toBe(0.16);
    // The sheet stays a left-to-right physical space inside the RTL UI.
    expect(StyleSheet.flatten(screen.getByTestId('compose-preview').props.style).direction).toBe(
      'ltr',
    );
  });

  it('never overwrites a design from a newer app version', async () => {
    const newer = { v: 3, paper: 'gold_foil', elements: [{ any: 'thing' }] };
    const { save } = await openCompose('en', draft({ design: newer }));
    await fireEvent.press(screen.getByTestId('compose-mode-decorate'));
    expect(screen.getByTestId('compose-read-only')).toBeTruthy();
    expect(screen.queryByLabelText('Add Dove stamp')).toBeNull();

    await fireEvent.press(screen.getByTestId('compose-mode-write'));
    await fireEvent.changeText(screen.getByTestId('compose-body'), 'Edited text');
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(lastSavedDesign(save)).toEqual(newer);
  });
});
