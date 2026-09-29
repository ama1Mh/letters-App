import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import en from '../src/core/i18n/locales/en.json';
import { mockAlerts } from './helpers/alerts';
import { SARA, letter } from './helpers/letterFixtures';
import { renderShellIn } from './helpers/renderShell';

describe('Reading view: delete for me and block (Phase 9)', () => {
  it('blocks the sender after confirming, then deletes the letter for me and goes back', async () => {
    const alerts = mockAlerts('cancel');
    const view = await renderShellIn(
      'en',
      undefined,
      [],
      {},
      { letters: [letter({ id: 'from-sara' })] },
    );
    const deleteForMe = jest.spyOn(view.letters, 'deleteLetterForMe');
    const block = jest.spyOn(view.discovery, 'blockUser');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/inbox'));
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/letter/from-sara'));
    await waitFor(() => expect(screen.getByTestId('letter-delete-for-me')).toBeTruthy());
    expect(screen.getByTestId('letter-report')).toBeTruthy();

    // Cancel: nothing happens.
    await fireEvent.press(screen.getByTestId('letter-delete-for-me'));
    expect(alerts.shown[0].title).toBe(en.letter.deleteConfirmTitle);
    expect(deleteForMe).not.toHaveBeenCalled();

    alerts.choose('confirm');
    await fireEvent.press(screen.getByTestId('letter-block'));
    expect(alerts.shown[1].title).toBe(en.letter.blockConfirmTitle);
    await waitFor(() =>
      expect(screen.getByTestId('letter-notice')).toHaveTextContent(en.letter.blocked),
    );
    expect(block).toHaveBeenCalledWith(SARA.id);

    await fireEvent.press(screen.getByTestId('letter-delete-for-me'));
    await waitFor(() => expect(deleteForMe).toHaveBeenCalledWith('from-sara'));
    await waitFor(() => expect(screen.queryByTestId('letter-screen')).toBeNull()); // went back
  });
});
