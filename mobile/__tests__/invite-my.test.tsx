import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { renderShellIn } from './helpers/renderShell';

describe('my invite', () => {
  it('shows the invite link, regenerates it, and redeems a manually entered code', async () => {
    await renderShellIn('en', undefined, [], {
      invite: { id: 'invite-1', code: 'ABCDEFGH23', revokedAt: null, expiresAt: null },
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/invite'));
    await waitFor(() => expect(screen.getByTestId('my-invite-screen')).toBeTruthy());
    await waitFor(() =>
      expect(screen.getByTestId('my-invite-link').props.value).toBe(
        'letterapp://invite/ABCDEFGH23',
      ),
    );

    await fireEvent.press(screen.getByTestId('my-invite-regenerate'));
    await waitFor(() =>
      expect(screen.getByTestId('my-invite-link').props.value).toBe(
        'letterapp://invite/ABCDEFGH23X',
      ),
    );

    await fireEvent.changeText(screen.getByTestId('my-invite-enter-code'), 'zzzzzzzzzz');
    await fireEvent.press(screen.getByTestId('my-invite-enter-code-submit'));
    await waitFor(() => expect(screen.getByTestId('my-invite-enter-code').props.value).toBe(''));
    expect(screen.getByTestId('my-invite-redeemed')).toBeTruthy();
  });

  it('leaves the title to the header and labels the field as the link', async () => {
    await renderShellIn('en', undefined, [], {
      invite: { id: 'invite-1', code: 'ABCDEFGH23', revokedAt: null, expiresAt: null },
    });
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/invite'));
    await waitFor(() => expect(screen.getByTestId('my-invite-link')).toBeTruthy());
    // The test shell does not draw stack headers, so the body itself must not repeat the title.
    expect(screen.queryAllByText('My invite')).toHaveLength(0);
    expect(screen.getByText('Your invite link')).toBeTruthy();
  });
});
