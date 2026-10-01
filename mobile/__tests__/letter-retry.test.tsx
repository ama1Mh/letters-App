import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import en from '../src/core/i18n/locales/en.json';
import { ME, SARA, letter } from './helpers/letterFixtures';
import { renderShellIn } from './helpers/renderShell';

describe('Reading view: a failed load (e.g. offline)', () => {
  it('shows the generic error with Try again, which loads the letter', async () => {
    const view = await renderShellIn(
      'en',
      undefined,
      [],
      {},
      { letters: [letter({ id: 'l1', viewerRole: 'recipient', sender: SARA, recipient: ME })] },
    );
    jest
      .spyOn(view.letters, 'getLetter')
      .mockRejectedValueOnce(new TypeError('Network request failed'));

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/letter/l1'));
    await waitFor(() => expect(screen.getByTestId('letter-error')).toBeTruthy());
    expect(screen.getByText(en.letters.error.unknown)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('letter-retry'));
    await waitFor(() => expect(screen.getByTestId('letter-screen')).toBeTruthy());
  });
});
