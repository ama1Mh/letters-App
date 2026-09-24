import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { fakeProfile } from './helpers/fakeAuthRepository';
import { renderShellIn } from './helpers/renderShell';

describe('sign in', () => {
  it('rejects bad credentials with a translated error, then signs in and lands on the inbox', async () => {
    // The fake's fixed credentials are sara@example.test / correct-horse (fakeAuthRepository.ts).
    // The profile is pre-set and already onboarded, so a successful sign-in reaches the tab shell.
    await renderShellIn('en', {
      session: null,
      profile: fakeProfile('user-sara', {
        username: 'sara_writes',
        displayName: 'Sara',
        onboardedAt: new Date().toISOString(),
      }),
    });
    await waitFor(() => expect(screen.getByTestId('sign-in-screen')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('sign-in-email'), 'sara@example.test');
    await fireEvent.changeText(screen.getByTestId('sign-in-password'), 'wrong-password');
    await fireEvent.press(screen.getByTestId('sign-in-submit'));
    await waitFor(() => expect(screen.getByTestId('sign-in-error')).toBeTruthy());
    expect(screen.getByText('Incorrect email or password.')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('sign-in-password'), 'correct-horse');
    await fireEvent.press(screen.getByTestId('sign-in-submit'));
    await waitFor(() => expect(screen.getByTestId('inbox-screen')).toBeTruthy());
  });
});
