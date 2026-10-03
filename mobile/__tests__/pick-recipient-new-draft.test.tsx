import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import type { SearchResult } from '@/data/discovery/discoveryRepository';
import { defaultDesign } from '@/domain/design';

import { renderShellIn } from './helpers/renderShell';

const EVERYONE_USER: SearchResult = {
  id: 'user-everyone',
  username: 'everyone_guy',
  displayName: 'Everyone Guy',
  avatarKey: null,
  receiveMode: 'everyone',
  connectionState: 'none',
};

describe('pick-recipient on a brand-new draft', () => {
  // Regression (Phase 12.6 phone QA): a new draft is only stored once it has content, so choosing
  // the recipient first found no draft and saved `design: undefined`, which the device's SQLite
  // store rejects (NOT NULL); the picker then never returned to the composer.
  it('saves the default design with the recipient and returns to the composer', async () => {
    const view = await renderShellIn('en', undefined, [], { searchResults: [EVERYONE_USER] });
    const save = jest.spyOn(view.drafts, 'save');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/compose/new-draft-x'));
    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('compose-recipient-row'));
    await waitFor(() => expect(screen.getByTestId('pick-recipient-search')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('pick-recipient-search'), 'everyone');
    await waitFor(() =>
      expect(screen.getByTestId('pick-recipient-write-user-everyone')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId('pick-recipient-write-user-everyone'));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'new-draft-x',
          recipientId: 'user-everyone',
          design: defaultDesign(),
        }),
      ),
    );
    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());
  });
});
