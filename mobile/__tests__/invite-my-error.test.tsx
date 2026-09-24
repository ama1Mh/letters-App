import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { renderShellIn } from './helpers/renderShell';

describe('my invite redeem error', () => {
  it('shows a translated error for an invalid manually entered code', async () => {
    await renderShellIn('en', undefined, [], { fail: { redeemInvite: 'invite_not_found' } });

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/invite'));
    await waitFor(() => expect(screen.getByTestId('my-invite-screen')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('my-invite-enter-code'), 'zzzzzzzzzz');
    await fireEvent.press(screen.getByTestId('my-invite-enter-code-submit'));
    await waitFor(() =>
      expect(screen.getByText('This invite code is invalid or has expired.')).toBeTruthy(),
    );
  });
});
