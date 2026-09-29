import { act, screen, waitFor } from 'expo-router/testing-library';

import { FAKE_PUSH_TOKEN } from './helpers/fakePushPlatform';
import { SARA, letter } from './helpers/letterFixtures';
import { renderShellIn } from './helpers/renderShell';

const LETTER_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('Delivery notifications in the running app (ar/RTL, Phase 7)', () => {
  it('registers this device once the user is ready, and a tap opens the letter', async () => {
    const view = await renderShellIn(
      'ar',
      undefined,
      [],
      {},
      { letters: [letter({ id: LETTER_ID, viewerRole: 'recipient', sender: SARA })] },
    );
    await waitFor(() => expect(view.devices.register).toHaveBeenCalledTimes(1));
    expect(view.devices.register).toHaveBeenCalledWith(FAKE_PUSH_TOKEN, 'android', '1.0.0');
    // The Android channel is named in the UI language.
    expect(view.push.ensureChannel).toHaveBeenCalledWith('الرسائل');
    expect(screen.getByTestId('inbox-screen')).toBeTruthy();

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => view.push.tap(LETTER_ID));
    await waitFor(() => expect(screen.getByTestId('letter-screen')).toBeTruthy());
    expect(screen.getByTestId('letter-correspondent')).toHaveTextContent(/Sara/);
  });
});
