import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import en from '../src/core/i18n/locales/en.json';
import { stashRecoveryLink } from '@/features/auth/recoveryLink';

import { renderShellIn } from './helpers/renderShell';

describe('Completing a password reset (en, OPEN-10)', () => {
  it('starts the recovery session, checks the new password, and lands in the app signed in', async () => {
    const view = await renderShellIn('en', { session: null, profile: null });
    await waitFor(() => expect(screen.getByTestId('sign-in-screen')).toBeTruthy());
    const update = jest.spyOn(view.backend.repository, 'updatePassword');

    stashRecoveryLink({
      kind: 'recovery',
      accessToken: 'recovery-token-for-user-sara',
      refreshToken: 'r',
    });
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/reset-password'));
    await waitFor(() => expect(screen.getByTestId('reset-password-screen')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('reset-password-new'), 'short');
    await fireEvent.changeText(screen.getByTestId('reset-password-confirm'), 'different');
    await fireEvent.press(screen.getByTestId('reset-password-submit'));
    expect(screen.getByTestId('reset-password-error')).toHaveTextContent(
      en.auth.resetPassword.error.mismatch,
    );
    expect(update).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('reset-password-confirm'), 'short');
    await fireEvent.press(screen.getByTestId('reset-password-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('reset-password-error')).toHaveTextContent(
        en.auth.resetPassword.error.weak_password,
      ),
    );

    await fireEvent.changeText(screen.getByTestId('reset-password-new'), 'a-much-better-one');
    await fireEvent.changeText(screen.getByTestId('reset-password-confirm'), 'a-much-better-one');
    await fireEvent.press(screen.getByTestId('reset-password-submit'));
    await waitFor(() => expect(screen.getByTestId('reset-password-done')).toBeTruthy());
    expect(update).toHaveBeenLastCalledWith('a-much-better-one');

    await fireEvent.press(screen.getByTestId('reset-password-continue'));
    await waitFor(() => expect(screen.getByTestId('inbox-screen')).toBeTruthy());
  });
});
