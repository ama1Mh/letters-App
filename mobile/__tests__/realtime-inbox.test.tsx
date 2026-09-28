import { act, screen, waitFor } from 'expo-router/testing-library';
import { AppState, type AppStateStatus } from 'react-native';

// Only test helpers are imported here: importing app modules before ./helpers/renderShell would
// load them before its jest.mock() calls register (the real Supabase client would be built).

import { inboxItem } from './helpers/letterFixtures';
import { renderShellIn } from './helpers/renderShell';

describe('Realtime: inbox refresh', () => {
  it('subscribes to my private topic and refreshes on events, reconnects and foregrounding', async () => {
    // Capture the app's AppState listener so the test can play background -> foreground.
    let appStateListener: ((state: AppStateStatus) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListener = listener as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });

    const view = await renderShellIn('en');
    const listInbox = jest.spyOn(view.letters, 'listInbox');

    await waitFor(() => expect(screen.getByTestId('inbox-empty')).toBeTruthy());
    expect(view.letters.realtime.topics()).toEqual(['letters:user-shell']);
    const settle = async () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        jest.runOnlyPendingTimers(); // fires the provider's coalescing timer
      });
    };
    await settle();
    let loads = listInbox.mock.calls.length;

    // A delivery: the new letter appears without leaving the screen.
    view.letters.realtime.addInboxItem(inboxItem({ id: 'live', subject: 'Just arrived' }));
    view.letters.realtime.emit({ type: 'letter_delivered', letterId: 'live', messageId: 'm1' });
    await settle();
    await waitFor(() => expect(screen.getByTestId('inbox-row-live')).toBeTruthy());
    expect(listInbox.mock.calls.length).toBe(loads + 1);
    loads = listInbox.mock.calls.length;

    // The same Realtime message again (a redelivery): ignored.
    view.letters.realtime.emit({ type: 'letter_delivered', letterId: 'live', messageId: 'm1' });
    await settle();
    expect(listInbox.mock.calls.length).toBe(loads);

    // A burst of distinct events: one reload, not three.
    for (const messageId of ['m2', 'm3', 'm4']) {
      view.letters.realtime.emit({ type: 'letter_read', letterId: 'live', messageId });
    }
    await settle();
    expect(listInbox.mock.calls.length).toBe(loads + 1);
    loads = listInbox.mock.calls.length;

    // Reconnect: the channel re-subscribes; events may have been missed, so refetch.
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => view.letters.realtime.resubscribe());
    await waitFor(() => expect(listInbox.mock.calls.length).toBe(loads + 1));
    loads = listInbox.mock.calls.length;

    // Background -> foreground: refetch. Going to the background alone does not.
    expect(appStateListener).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => appStateListener?.('background'));
    expect(listInbox.mock.calls.length).toBe(loads);
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => appStateListener?.('active'));
    await waitFor(() => expect(listInbox.mock.calls.length).toBe(loads + 1));
  });
});
