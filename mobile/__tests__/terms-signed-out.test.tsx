import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { renderShellIn } from './helpers/renderShell';

describe('terms from sign-up (en, signed out, DEC-054)', () => {
  it('opens without an account', async () => {
    await renderShellIn('en', { session: null, profile: null });
    await fireEvent.press(await screen.findByTestId('sign-in-go-sign-up'));
    await fireEvent.press(await screen.findByTestId('sign-up-terms'));
    await waitFor(() => expect(screen.getByTestId('terms-screen')).toBeTruthy());
  });
});
