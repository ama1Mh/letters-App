import { screen, waitFor } from 'expo-router/testing-library';

import { fakeProfile } from './helpers/fakeAuthRepository';
import { renderShellIn } from './helpers/renderShell';

describe('auth gate', () => {
  it('shows onboarding (skipping sign-in) when there is a session but no completed profile', async () => {
    await renderShellIn('en', {
      session: { userId: 'user-1' },
      profile: fakeProfile('user-1'), // onboardedAt: null by default
    });
    await waitFor(() => expect(screen.getByTestId('onboarding-screen')).toBeTruthy());
  });
});
