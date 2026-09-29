import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import ar from '../src/core/i18n/locales/ar.json';
import { stashRecoveryLink } from '@/features/auth/recoveryLink';

import { renderShellIn } from './helpers/renderShell';

describe('An expired password-reset link (ar/RTL, OPEN-10)', () => {
  it('shows one neutral message and offers a new email; no session is started', async () => {
    const view = await renderShellIn('ar', { session: null, profile: null });
    await waitFor(() => expect(screen.getByTestId('sign-in-screen')).toBeTruthy());
    const start = jest.spyOn(view.backend.repository, 'startPasswordRecovery');

    stashRecoveryLink({ kind: 'recovery', accessToken: 'expired', refreshToken: 'r' });
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/reset-password'));
    await waitFor(() => expect(screen.getByTestId('reset-password-invalid')).toBeTruthy());
    expect(start).toHaveBeenCalledTimes(1);
    expect(screen.getByText(ar.auth.resetPassword.invalidTitle)).toBeTruthy();
    expect(await view.backend.repository.getSession()).toBeNull();

    await fireEvent.press(screen.getByTestId('reset-password-request-new'));
    await waitFor(() => expect(screen.getByTestId('forgot-password-screen')).toBeTruthy());
  });
});
