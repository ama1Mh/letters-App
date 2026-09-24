import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { renderShellIn } from './helpers/renderShell';

describe('profile tab navigation (Phase 5 rows)', () => {
  it('connections, my invite and privacy rows each navigate to their screen', async () => {
    await renderShellIn('en');

    await fireEvent.press(screen.getAllByText('Profile')[0]);
    await waitFor(() => expect(screen.getByTestId('profile-connections-row')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('profile-connections-row'));
    await waitFor(() => expect(screen.getByTestId('connections-empty')).toBeTruthy());

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.back());
    await waitFor(() => expect(screen.getByTestId('profile-my-invite-row')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('profile-my-invite-row'));
    await waitFor(() => expect(screen.getByTestId('my-invite-screen')).toBeTruthy());

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.back());
    await waitFor(() => expect(screen.getByTestId('profile-privacy-row')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('profile-privacy-row'));
    await waitFor(() => expect(screen.getByTestId('privacy-screen')).toBeTruthy());
  });
});
