import { act, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { stashRecoveryLink } from '@/features/auth/recoveryLink';

import { renderShellIn } from './helpers/renderShell';

describe('A reset link opened while another account is signed in', () => {
  it('signs that account out properly first (push, drafts), then starts the recovery session', async () => {
    const view = await renderShellIn('en'); // signed in as user-shell
    await waitFor(() => expect(screen.getByTestId('inbox-screen')).toBeTruthy());
    await waitFor(() => expect(view.devices.register).toHaveBeenCalledTimes(1));
    const release = jest.spyOn(view.drafts, 'releaseForSignOut');
    const start = jest.spyOn(view.backend.repository, 'startPasswordRecovery');

    stashRecoveryLink({
      kind: 'recovery',
      accessToken: 'recovery-token-for-user-sara',
      refreshToken: 'r',
    });
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/reset-password'));
    await waitFor(() => expect(screen.getByTestId('reset-password-screen')).toBeTruthy());

    expect(view.devices.unregister).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(release.mock.invocationCallOrder[0]).toBeLessThan(start.mock.invocationCallOrder[0]);
    expect(await view.backend.repository.getSession()).toEqual({ userId: 'user-sara' });
  });
});
