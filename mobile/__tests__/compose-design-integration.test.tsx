import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import type { LocalDraft } from '@/data/local/draftsStore';

import { renderShellIn } from './helpers/renderShell';

const DRAFT: LocalDraft = {
  id: 'draft-a',
  subject: 'Hi',
  body: 'Hello',
  bodyDir: 'ltr',
  design: {
    v: 2,
    paper: 'aged_cream',
    font: 'caveat',
    ink: 'black',
    textSize: 'm',
    layout: 'standard',
    elements: [],
  },
  recipientId: null,
  dirty: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('compose <-> design picker integration', () => {
  it('shows a live preview, and a design chosen in the picker shows up back on compose', async () => {
    const view = await renderShellIn('en', undefined, [DRAFT]);
    const save = jest.spyOn(view.drafts, 'save');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push(`/compose/${DRAFT.id}`));
    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());

    // Live preview reflects the loaded draft's default (aged_cream) paper.
    await waitFor(
      () =>
        expect(
          StyleSheet.flatten(screen.getByTestId('compose-preview').props.style)?.backgroundColor,
        ).toBe('#EFE2C4'), // aged_cream
    );

    await fireEvent.press(screen.getByTestId('compose-change-design'));
    await waitFor(() => expect(screen.getByTestId('pick-design-screen')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('pick-design-paper-warm_ivory'));
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: DRAFT.id,
          design: expect.objectContaining({ paper: 'warm_ivory' }),
        }),
      ),
    );
    expect((await view.drafts.get(DRAFT.id))?.design).toMatchObject({ paper: 'warm_ivory' });

    await fireEvent.press(screen.getByTestId('pick-design-back'));
    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());
    await waitFor(
      () =>
        expect(
          StyleSheet.flatten(screen.getByTestId('compose-preview').props.style)?.backgroundColor,
        ).toBe('#F8F1E1'), // warm_ivory - picked up via useFocusEffect, not a second manual save
    );
  });
});
