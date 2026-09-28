import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { LetterActionError } from '@/data/letters/lettersRepository';

import en from '../src/core/i18n/locales/en.json';
import { mockAlerts } from './helpers/alerts';
import { sentItem } from './helpers/letterFixtures';
import { renderShellIn } from './helpers/renderShell';

describe('Sent tab: failures', () => {
  it('offers a retry after a failed load, and refreshes when unscheduling finds the letter already delivered', async () => {
    mockAlerts('confirm');
    const scheduled = sentItem({
      id: 'racing',
      status: 'scheduled',
      deliveredAt: null,
      scheduledAt: '2026-10-01T12:00:00.000Z',
    });
    const view = await renderShellIn('en', undefined, [], {}, { sent: { scheduled: [scheduled] } });

    const listSent = jest
      .spyOn(view.letters, 'listSent')
      .mockRejectedValueOnce(new TypeError('Network request failed'));

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push({ pathname: '/sent', params: { view: 'scheduled' } }));
    await waitFor(() =>
      expect(screen.getByTestId('sent-load-error')).toHaveTextContent(en.letters.error.unknown),
    );

    await fireEvent.press(screen.getByTestId('sent-retry'));
    await waitFor(() => expect(screen.getByTestId('sent-row-racing')).toBeTruthy());

    // The letter was delivered between loading the list and pressing Unschedule.
    jest
      .spyOn(view.letters, 'unscheduleLetter')
      .mockRejectedValueOnce(new LetterActionError('already_delivered'));
    listSent.mockResolvedValueOnce({ items: [], nextCursor: null });
    const loadsBefore = listSent.mock.calls.length;

    await fireEvent.press(screen.getByTestId('sent-row-racing-unschedule'));
    await waitFor(() =>
      expect(screen.getByTestId('sent-action-error')).toHaveTextContent(
        en.letters.error.already_delivered,
      ),
    );
    await waitFor(() => expect(screen.getByTestId('sent-scheduled-empty')).toBeTruthy());
    expect(listSent.mock.calls.length).toBeGreaterThan(loadsBefore); // the stale list was reloaded
  });
});
