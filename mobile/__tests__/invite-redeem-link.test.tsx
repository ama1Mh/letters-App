import { act, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { renderShellIn } from './helpers/renderShell';

describe('redeem invite deep link', () => {
  it('redeems the code from the route and shows the success state', async () => {
    await renderShellIn('en');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/invite/SOMECODE99'));
    await waitFor(() => expect(screen.getByTestId('redeem-invite-success-title')).toBeTruthy());
    expect(screen.getByText("You're connected!")).toBeTruthy();
  });
});
