import { act, screen, waitFor } from 'expo-router/testing-library';

import { fakeProfile } from './helpers/fakeAuthRepository';
import { renderShellIn } from './helpers/renderShell';

describe('Profile locale follows the UI language', () => {
  it('rewrites profiles.locale when the app runs in another language than the stored one', async () => {
    // Signed up in Arabic, then switched the app to English: push text must follow (DEC-050).
    const view = await renderShellIn('en', {
      session: { userId: 'user-1' },
      profile: fakeProfile('user-1', {
        username: 'sara_92',
        displayName: 'Sara',
        locale: 'ar',
        onboardedAt: '2026-09-01T00:00:00.000Z',
      }),
    });

    await waitFor(() => expect(screen.getByTestId('inbox-screen')).toBeTruthy());
    await act(async () => {});
    expect((await view.backend.repository.getOwnProfile('user-1'))?.locale).toBe('en');
  });
});
