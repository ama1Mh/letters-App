import { screen, waitFor } from 'expo-router/testing-library';

import { SARA, letter } from './helpers/letterFixtures';
import { renderShellIn } from './helpers/renderShell';

const LETTER_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('App cold-started from a delivery notification', () => {
  it('opens that letter once the auth gate lets the user in', async () => {
    await renderShellIn(
      'en',
      undefined,
      [],
      {},
      { letters: [letter({ id: LETTER_ID, viewerRole: 'recipient', sender: SARA })] },
      { launchLetterId: LETTER_ID },
    );
    await waitFor(() => expect(screen.getByTestId('letter-screen')).toBeTruthy());
  });
});
