import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import type { LocalDraft } from '@/data/local/draftsStore';

import { renderShellIn } from './helpers/renderShell';

const DRAFT: LocalDraft = {
  id: 'draft-a',
  subject: 'Hello',
  body: 'مرحبا',
  bodyDir: 'rtl',
  design: {
    v: 1,
    paper: 'cream',
    font: 'caveat',
    ink: 'classic_black',
    layout: 'standard',
    stamp: null,
    stickers: [],
  },
  recipientId: null,
  dirty: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('pick-design', () => {
  it('shows only Arabic-capable fonts for an rtl draft, applies choices immediately, and persists them', async () => {
    const view = await renderShellIn('en', undefined, [DRAFT]);

    // Push through compose first, so "back" from the picker has somewhere real to return to.
    // eslint-disable-next-line @typescript-eslint/require-await -- act's async form flushes
    // microtasks more thoroughly than the sync form; router.push() itself is still synchronous.
    await act(async () => router.push(`/compose/${DRAFT.id}`));
    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () =>
      router.push({ pathname: '/compose/pick-design', params: { id: DRAFT.id } }),
    );
    await waitFor(() => expect(screen.getByTestId('pick-design-screen')).toBeTruthy());

    // The screen renders immediately with ltr defaults, before the draft (bodyDir: rtl) loads -
    // wait for that load, not just the screen's existence: caveat (latin-only) must not be offered
    // for this rtl draft once it has, while cairo/tajawal/amiri (Arabic) are.
    await waitFor(() => expect(screen.queryByTestId('pick-design-font-caveat')).toBeNull());
    expect(screen.getByTestId('pick-design-font-cairo')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('pick-design-paper-sky'));
    await fireEvent.press(screen.getByTestId('pick-design-font-cairo'));
    await fireEvent.press(screen.getByTestId('pick-design-ink-navy'));
    await fireEvent.press(screen.getByTestId('pick-design-stamp-heart'));

    await waitFor(async () => {
      const saved = await view.drafts.get(DRAFT.id);
      expect(saved?.design).toMatchObject({
        paper: 'sky',
        font: 'cairo',
        ink: 'navy',
        stamp: 'heart',
      });
    });

    await fireEvent.press(screen.getByTestId('pick-design-back'));
    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());
  });
});
