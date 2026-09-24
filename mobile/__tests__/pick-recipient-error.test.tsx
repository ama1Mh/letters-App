import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import type { LocalDraft } from '@/data/local/draftsStore';

import { renderShellIn } from './helpers/renderShell';

const DRAFT: LocalDraft = {
  id: 'draft-a',
  subject: null,
  body: 'Hello',
  bodyDir: 'ltr',
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

describe('pick-recipient error handling', () => {
  it('does not search below 3 characters, and shows a translated error for a failed search', async () => {
    await renderShellIn('en', undefined, [DRAFT], { fail: { searchUsers: 'query_too_short' } });

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push(`/compose/${DRAFT.id}`));
    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () =>
      router.push({ pathname: '/compose/pick-recipient', params: { id: DRAFT.id } }),
    );
    await waitFor(() => expect(screen.getByTestId('pick-recipient-search')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('pick-recipient-search'), 'ab');
    expect(screen.queryByTestId('pick-recipient-error')).toBeNull(); // below the 3-char floor: no call at all

    await fireEvent.changeText(screen.getByTestId('pick-recipient-search'), 'abc');
    await waitFor(() => expect(screen.getByTestId('pick-recipient-error')).toBeTruthy());
    expect(screen.getByText('Type at least 3 characters.')).toBeTruthy();
  });
});
