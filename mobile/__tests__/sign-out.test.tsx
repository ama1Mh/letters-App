import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { renderShellIn } from './helpers/renderShell';

describe('sign out', () => {
  it('signs out from the profile tab and lands back on sign-in', async () => {
    await renderShellIn('en'); // default: already signed in and onboarded
    await waitFor(() => expect(screen.getByTestId('inbox-screen')).toBeTruthy());

    await fireEvent.press(screen.getAllByText('Profile')[0]);
    await waitFor(() => expect(screen.getByTestId('profile-screen')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('profile-sign-out-row'));
    await waitFor(() => expect(screen.getByTestId('sign-in-screen')).toBeTruthy());
  });
});
