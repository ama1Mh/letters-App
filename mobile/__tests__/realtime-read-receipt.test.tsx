import { act, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import en from '../src/core/i18n/locales/en.json';
import { ME, SARA, letter } from './helpers/letterFixtures';
import { renderShellIn } from './helpers/renderShell';

describe('Realtime: the sender sees the read receipt arrive', () => {
  it('refetches the open letter on its own letter_read event, and ignores other letters', async () => {
    const view = await renderShellIn(
      'en',
      undefined,
      [],
      {},
      {
        letters: [
          letter({ id: 'mine', viewerRole: 'sender', sender: ME, recipient: SARA }),
          letter({ id: 'other', viewerRole: 'sender', sender: ME, recipient: SARA }),
        ],
      },
    );
    const getLetter = jest.spyOn(view.letters, 'getLetter');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/letter/mine'));
    await waitFor(() => expect(screen.getByTestId('letter-screen')).toBeTruthy());
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      jest.runOnlyPendingTimers(); // fires the provider's coalescing timer
    });
    expect(screen.queryByTestId('letter-read')).toBeNull();
    const loads = getLetter.mock.calls.length;

    // Another letter's event: no refetch of this one.
    view.letters.realtime.emit({ type: 'letter_read', letterId: 'other', messageId: 'r0' });
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      jest.runOnlyPendingTimers(); // fires the provider's coalescing timer
    });
    expect(getLetter.mock.calls.length).toBe(loads);

    // Sara reads it (server side), and the recipient-shares-receipts broadcast reaches the sender.
    await view.letters.markRead('mine');
    view.letters.realtime.emit({ type: 'letter_read', letterId: 'mine', messageId: 'r1' });
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      jest.runOnlyPendingTimers(); // fires the provider's coalescing timer
    });
    await waitFor(() => expect(screen.getByTestId('letter-read')).toHaveTextContent(en.sent.read));
    expect(getLetter.mock.calls.length).toBe(loads + 1);
  });
});
