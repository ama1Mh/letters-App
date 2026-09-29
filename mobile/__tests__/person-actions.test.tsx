import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';

import en from '../src/core/i18n/locales/en.json';
import { renderShellIn } from './helpers/renderShell';

const INCOMING = {
  id: 'conn-in-1',
  otherUserId: 'user-incoming',
  otherUsername: 'incoming_user',
  otherDisplayName: 'Incoming User',
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** Presses the button with this text in every Alert shown, recording the titles. */
function pressInAlerts(choices: string[]) {
  const titles: string[] = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, _message, buttons: AlertButton[] = []) => {
    titles.push(title);
    const choice = choices.shift();
    buttons.find((button) => button.text === choice)?.onPress?.();
  });
  return titles;
}

describe('Report / Block on a person (DEC-013)', () => {
  it('opens the report screen, and blocks after confirming, from a connection request', async () => {
    const view = await renderShellIn('en', undefined, [], {
      pending: { incoming: [INCOMING], outgoing: [] },
    });
    const block = jest.spyOn(view.discovery, 'blockUser');
    const listPending = jest.spyOn(view.discovery, 'listPendingConnections');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/connections'));
    await waitFor(() => expect(screen.getByTestId('connections-actions-conn-in-1')).toBeTruthy());

    // Menu -> Report: the report screen for that person.
    let titles = pressInAlerts([en.letter.report]);
    await fireEvent.press(screen.getByTestId('connections-actions-conn-in-1'));
    expect(titles).toEqual([en.safety.actionsTitle]);
    await waitFor(() => expect(screen.getByTestId('report-screen')).toBeTruthy());

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.back());
    await waitFor(() => expect(screen.getByTestId('connections-actions-conn-in-1')).toBeTruthy());

    // Menu -> Block -> confirm: blocked, and the list is reloaded.
    const loadsBefore = listPending.mock.calls.length;
    titles = pressInAlerts([en.letter.block, en.letter.block]);
    await fireEvent.press(screen.getByTestId('connections-actions-conn-in-1'));
    await waitFor(() => expect(block).toHaveBeenCalledWith('user-incoming'));
    expect(titles).toEqual([en.safety.actionsTitle, en.letter.blockConfirmTitle]);
    await waitFor(() => expect(listPending.mock.calls.length).toBeGreaterThan(loadsBefore));
  });
});
