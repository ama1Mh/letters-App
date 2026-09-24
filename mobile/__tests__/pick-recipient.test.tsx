import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import type { LocalDraft } from '@/data/local/draftsStore';
import type { SearchResult } from '@/data/discovery/discoveryRepository';

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

const EVERYONE_USER: SearchResult = {
  id: 'user-everyone',
  username: 'everyone_guy',
  displayName: 'Everyone Guy',
  avatarKey: null,
  receiveMode: 'everyone',
  connectionState: 'none',
};

const INVITE_ONLY_USER: SearchResult = {
  id: 'user-invite-only',
  username: 'invite_gal',
  displayName: 'Invite Gal',
  avatarKey: null,
  receiveMode: 'invite_only',
  connectionState: 'none',
};

describe('pick-recipient', () => {
  // Only one renderShellIn() per test file (see its own doc comment): both the "everyone" write
  // path and the "invite_only" connection-request path are exercised against the same render.
  it('offers "Write letter" for everyone-mode, "Send request" for invite_only, and both work', async () => {
    const view = await renderShellIn('en', undefined, [DRAFT], {
      searchResults: [EVERYONE_USER, INVITE_ONLY_USER],
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push(`/compose/${DRAFT.id}`));
    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () =>
      router.push({ pathname: '/compose/pick-recipient', params: { id: DRAFT.id } }),
    );
    await waitFor(() => expect(screen.getByTestId('pick-recipient-search')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('pick-recipient-search'), 'guy');
    await waitFor(() =>
      expect(screen.getByTestId('pick-recipient-write-user-everyone')).toBeTruthy(),
    );
    // invite_only, not connected: offered a connection request, not a "Write letter" button.
    expect(screen.getByTestId('pick-recipient-request-user-invite-only')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('pick-recipient-request-user-invite-only'));
    await waitFor(() => expect(screen.getByText('Requested')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('pick-recipient-write-user-everyone'));
    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());
    await waitFor(async () => {
      const saved = await view.drafts.get(DRAFT.id);
      expect(saved?.recipientId).toBe('user-everyone');
    });
    expect(screen.getByText('Recipient selected')).toBeTruthy();
  });
});
