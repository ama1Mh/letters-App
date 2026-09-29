import { screen, waitFor } from 'expo-router/testing-library';

import { fakeProfile } from './helpers/fakeAuthRepository';
import { renderShellIn } from './helpers/renderShell';

describe('A session for an account deleted elsewhere', () => {
  it('is signed out and lands on sign-in instead of the tabs', async () => {
    const view = await renderShellIn('en', {
      session: { userId: 'gone-user' },
      profile: fakeProfile('gone-user', {
        username: 'gone_user',
        displayName: 'gone_user',
        onboardedAt: '2026-09-01T00:00:00.000Z',
        deletedAt: '2026-09-29T00:00:00.000Z',
      }),
    });

    await waitFor(() => expect(screen.getByTestId('sign-in-screen')).toBeTruthy());
    expect(screen.queryByTestId('inbox-screen')).toBeNull();
    // The stale session was ended, not just hidden.
    expect(await view.backend.repository.getSession()).toBeNull();
  });
});
