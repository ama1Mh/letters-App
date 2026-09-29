import { router } from 'expo-router';
import { act, screen, waitFor } from 'expo-router/testing-library';

import { fakeProfile } from './helpers/fakeAuthRepository';
import { SARA, letter } from './helpers/letterFixtures';
import { renderShellIn } from './helpers/renderShell';

const LETTER_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('A notification tap while signed out', () => {
  it('waits on the sign-in screen, registers nothing, and opens the letter after sign-in', async () => {
    const view = await renderShellIn(
      'en',
      {
        session: null,
        profile: fakeProfile('user-shell', {
          username: 'shell_user',
          onboardedAt: new Date().toISOString(),
        }),
      },
      [],
      {},
      { letters: [letter({ id: LETTER_ID, viewerRole: 'recipient', sender: SARA })] },
      { launchLetterId: LETTER_ID },
    );
    await waitFor(() => expect(screen.getByTestId('sign-in-screen')).toBeTruthy());
    expect(screen.queryByTestId('letter-screen')).toBeNull();
    expect(view.devices.register).not.toHaveBeenCalled();

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      // What the sign-in screen does on success: session, then back through the gate.
      view.backend.setSession({ userId: 'user-shell' });
      router.replace('/');
    });
    await waitFor(() => expect(screen.getByTestId('letter-screen')).toBeTruthy());
    expect(view.devices.register).toHaveBeenCalledTimes(1);
  });
});
