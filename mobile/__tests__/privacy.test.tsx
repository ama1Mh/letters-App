import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { renderShellIn } from './helpers/renderShell';

describe('privacy settings', () => {
  it('changes receive mode and discoverability, saving each immediately', async () => {
    await renderShellIn('en');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/settings/privacy'));
    await waitFor(() => expect(screen.getByTestId('privacy-screen')).toBeTruthy());

    // Default fixture (fakeAuthRepository's fakeProfile()) is invite_only.
    expect(
      screen.getByTestId('privacy-receive-mode-invite_only').props.accessibilityState.checked,
    ).toBe(true);

    await fireEvent.press(screen.getByTestId('privacy-receive-mode-everyone'));
    await waitFor(() =>
      expect(
        screen.getByTestId('privacy-receive-mode-everyone').props.accessibilityState.checked,
      ).toBe(true),
    );

    fireEvent(screen.getByTestId('privacy-discoverable-by-email'), 'valueChange', true);
    await waitFor(() =>
      expect(screen.getByTestId('privacy-discoverable-by-email').props.value).toBe(true),
    );
  });
});
