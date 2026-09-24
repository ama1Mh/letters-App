import { screen, waitFor } from 'expo-router/testing-library';

import { renderShellIn } from './helpers/renderShell';

describe('auth gate', () => {
  it('shows sign-in when there is no session', async () => {
    await renderShellIn('en', { session: null, profile: null });
    await waitFor(() => expect(screen.getByTestId('sign-in-screen')).toBeTruthy());
  });
});
