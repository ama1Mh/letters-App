import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import en from '../src/core/i18n/locales/en.json';
import { inboxItem, letter } from './helpers/letterFixtures';
import { renderShellIn } from './helpers/renderShell';

describe('Inbox and reading a letter', () => {
  it('marks unread letters, opens one, marks it read once, and shows it read on return', async () => {
    const view = await renderShellIn(
      'en',
      undefined,
      [],
      {},
      {
        inbox: [
          inboxItem({ id: 'new', subject: 'Fresh news' }),
          inboxItem({ id: 'old', subject: 'Seen it', readAt: '2026-09-28T11:00:00.000Z' }),
        ],
        letters: [letter({ id: 'new', subject: 'Fresh news', body: 'The whole letter body.' })],
      },
    );
    const markRead = jest.spyOn(view.letters, 'markRead');

    // Inbox is the first tab.
    await waitFor(() => expect(screen.getByTestId('inbox-row-new')).toBeTruthy());
    expect(screen.getByTestId('inbox-row-new-unread')).toBeTruthy();
    expect(screen.queryByTestId('inbox-row-old-unread')).toBeNull();
    expect(screen.getByTestId('inbox-row-new').props.accessibilityHint).toBe(en.inbox.unread);

    await fireEvent.press(screen.getByTestId('inbox-row-new'));
    await waitFor(() => expect(screen.getByTestId('letter-screen')).toBeTruthy());
    expect(screen.getByText('The whole letter body.')).toBeTruthy();
    expect(screen.getByTestId('letter-when')).toHaveTextContent(/^Delivered /);
    expect(screen.getByText(`${en.letter.from} Sara`)).toBeTruthy();
    await waitFor(() => expect(markRead).toHaveBeenCalledWith('new'));
    expect(markRead).toHaveBeenCalledTimes(1);
    // A recipient does not see the sender-side "Read" label.
    expect(screen.queryByTestId('letter-read')).toBeNull();

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.back());
    await waitFor(() => expect(screen.getByTestId('inbox-row-new')).toBeTruthy());
    await waitFor(() => expect(screen.queryByTestId('inbox-row-new-unread')).toBeNull());
    expect(markRead).toHaveBeenCalledTimes(1);
  });
});
