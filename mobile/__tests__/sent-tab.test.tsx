import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import en from '../src/core/i18n/locales/en.json';
import { DELETED, sentItem } from './helpers/letterFixtures';
import { renderShellIn } from './helpers/renderShell';

const LRI = '⁦';
const PDI = '⁩';

describe('Sent tab', () => {
  it('lists sent letters with status and read state, and switches to Scheduled', async () => {
    const view = await renderShellIn(
      'en',
      undefined,
      [],
      {},
      {
        sent: {
          sent: [
            sentItem({ id: 'read', subject: 'Read one', readAt: '2026-09-28T10:00:00.000Z' }),
            sentItem({
              id: 'failed',
              status: 'undeliverable',
              deliveredAt: null,
              scheduledAt: '2026-09-27T08:00:00.000Z',
            }),
            sentItem({ id: 'gone', recipient: DELETED, preview: 'مرحبا', bodyDir: 'rtl' }),
          ],
          scheduled: [
            sentItem({
              id: 'later',
              status: 'scheduled',
              deliveredAt: null,
              scheduledAt: '2026-10-01T12:00:00.000Z',
            }),
          ],
        },
      },
    );

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/sent'));
    await waitFor(() => expect(screen.getByTestId('sent-row-read')).toBeTruthy());

    // Default kind is Sent.
    expect(screen.getByTestId('sent-switch-sent').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(view.letters.calls).toContainEqual({ method: 'listSent', kind: 'sent' });

    // Display name with @username beside it, LTR-isolated.
    expect(screen.getAllByText('To Sara').length).toBeGreaterThan(0);
    expect(screen.getAllByText(`${LRI}@sara${PDI}`).length).toBeGreaterThan(0);

    expect(screen.getByTestId('sent-row-read-status')).toHaveTextContent(/^Delivered /);
    expect(screen.getByTestId('sent-row-read-read')).toHaveTextContent(en.sent.read);
    expect(screen.queryByTestId('sent-row-failed-read')).toBeNull();
    expect(screen.getByTestId('sent-row-failed-status')).toHaveTextContent(en.sent.undeliverable);
    expect(screen.getByText(`${en.sent.to} ${en.letters.deletedAccount}`)).toBeTruthy();
    // Delivered letters cannot be unscheduled.
    expect(screen.queryByTestId('sent-row-read-unschedule')).toBeNull();

    await fireEvent.press(screen.getByTestId('sent-switch-scheduled'));
    await waitFor(() => expect(screen.getByTestId('sent-row-later')).toBeTruthy());
    expect(screen.getByTestId('sent-switch-scheduled').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.queryByTestId('sent-row-read')).toBeNull();
    expect(view.letters.calls).toContainEqual({ method: 'listSent', kind: 'scheduled' });
    expect(screen.getByTestId('sent-row-later-status')).toHaveTextContent(/^Delivers .*2026/);
    expect(screen.getByTestId('sent-row-later-unschedule')).toBeTruthy();
  });
});
