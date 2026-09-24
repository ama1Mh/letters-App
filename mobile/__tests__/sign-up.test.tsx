import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { renderShellIn } from './helpers/renderShell';

describe('sign up', () => {
  it('creates an account and shows the email-confirmation screen (DEC-038: confirmations required)', async () => {
    await renderShellIn('en', { session: null, profile: null });
    await waitFor(() => expect(screen.getByTestId('sign-in-screen')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('sign-in-go-sign-up'));
    await waitFor(() => expect(screen.getByTestId('sign-up-screen')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.test');
    await fireEvent.changeText(screen.getByTestId('sign-up-password'), 'a-strong-password');
    await fireEvent.press(screen.getByTestId('sign-up-submit'));

    await waitFor(() => expect(screen.getByTestId('sign-up-confirmation')).toBeTruthy());
    expect(
      screen.getByText('We sent a confirmation link to new@example.test. Open it, then sign in.'),
    ).toBeTruthy();
  });
});
