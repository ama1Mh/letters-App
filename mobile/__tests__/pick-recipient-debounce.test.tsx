import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import type { LocalDraft } from '@/data/local/draftsStore';

import { renderShellIn } from './helpers/renderShell';

const DRAFT: LocalDraft = {
  id: 'draft-d',
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

describe('pick-recipient search debounce', () => {
  it('searches once for the final text after typing pauses, not per keystroke', async () => {
    const view = await renderShellIn('en', undefined, [DRAFT]);
    const search = jest.spyOn(view.discovery, 'searchUsers');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () =>
      router.push({ pathname: '/compose/pick-recipient', params: { id: DRAFT.id } }),
    );
    await waitFor(() => expect(screen.getByTestId('pick-recipient-search')).toBeTruthy());

    for (const text of ['sar', 'sara', 'sara_', 'sara_9', 'sara_92']) {
      await fireEvent.changeText(screen.getByTestId('pick-recipient-search'), text);
    }
    // While waiting: a spinner, never a premature "no results".
    expect(screen.getByTestId('pick-recipient-searching')).toBeTruthy();
    expect(screen.queryByTestId('pick-recipient-no-results')).toBeNull();
    expect(search).not.toHaveBeenCalled();

    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    expect(search).toHaveBeenCalledWith('sara_92');
  });
});
