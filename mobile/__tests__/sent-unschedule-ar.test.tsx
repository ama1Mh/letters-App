import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import ar from '../src/core/i18n/locales/ar.json';
import { mockAlerts } from './helpers/alerts';
import { sentItem } from './helpers/letterFixtures';
import { renderShellIn } from './helpers/renderShell';

describe('Sent tab: unschedule (ar/RTL)', () => {
  it('asks first, then unschedules, removes the row, says so in Arabic and syncs drafts', async () => {
    const alerts = mockAlerts('cancel');
    const view = await renderShellIn(
      'ar',
      undefined,
      [],
      {},
      {
        sent: {
          scheduled: [
            sentItem({
              id: 'later',
              status: 'scheduled',
              deliveredAt: null,
              scheduledAt: '2026-10-01T12:00:00.000Z',
              preview: 'رسالة مجدولة',
              bodyDir: 'rtl',
            }),
          ],
        },
      },
    );
    const unschedule = jest.spyOn(view.letters, 'unscheduleLetter');
    const sync = jest.spyOn(view.drafts, 'sync');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push({ pathname: '/sent', params: { view: 'scheduled' } }));
    await waitFor(() => expect(screen.getByTestId('sent-row-later')).toBeTruthy());
    expect(screen.getByText(ar.sent.tabScheduled)).toBeTruthy();
    expect(screen.getByTestId('sent-row-later-status')).toHaveTextContent(
      new RegExp(`^${ar.sent.scheduledFor.split('{{')[0]}.*2026`),
    );
    expect(screen.getByTestId('sent-row-later-status')).not.toHaveTextContent(/[٠-٩]/);

    // Keep scheduled: nothing happens.
    await fireEvent.press(screen.getByTestId('sent-row-later-unschedule'));
    expect(alerts.shown[0].title).toBe(ar.sent.unscheduleConfirmTitle);
    expect(unschedule).not.toHaveBeenCalled();
    expect(screen.getByTestId('sent-row-later')).toBeTruthy();

    alerts.choose('confirm');
    await fireEvent.press(screen.getByTestId('sent-row-later-unschedule'));
    await waitFor(() =>
      expect(screen.getByTestId('sent-unscheduled-notice')).toHaveTextContent(ar.sent.unscheduled),
    );
    expect(unschedule).toHaveBeenCalledWith('later');
    expect(screen.queryByTestId('sent-row-later')).toBeNull();
    expect(screen.getByTestId('sent-scheduled-empty')).toBeTruthy();
    expect(sync).toHaveBeenCalled();
  });
});
