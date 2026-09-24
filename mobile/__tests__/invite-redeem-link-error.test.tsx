import { act, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { renderShellIn } from './helpers/renderShell';

describe('redeem invite deep link error', () => {
  it('shows an error state when redemption fails', async () => {
    await renderShellIn('en', undefined, [], { fail: { redeemInvite: 'invite_not_found' } });

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/invite/BADCODE000'));
    await waitFor(() => expect(screen.getByTestId('redeem-invite-error-title')).toBeTruthy());
    expect(screen.getByText('This invite code is invalid or has expired.')).toBeTruthy();
  });
});
