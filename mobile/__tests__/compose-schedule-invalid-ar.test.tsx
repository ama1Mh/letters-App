import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import type { LocalDraft } from '@/data/local/draftsStore';

import ar from '../src/core/i18n/locales/ar.json';
import { mockAlerts } from './helpers/alerts';
import { renderShellIn } from './helpers/renderShell';

const DRAFT: LocalDraft = {
  id: 'draft-too-early',
  subject: null,
  body: 'رسالة مجدولة',
  bodyDir: 'rtl',
  design: {
    v: 2,
    paper: 'aged_cream',
    font: 'cairo',
    ink: 'black',
    textSize: 'm',
    layout: 'standard',
    elements: [],
  },
  recipientId: 'user-everyone',
  dirty: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const PAST_MESSAGE = ar.letters.error.schedule_in_past;

describe('compose: invalid schedule times (ar/RTL)', () => {
  it('flags a past time in Arabic, blocks it, and never sends a time that has passed while picking', async () => {
    const alerts = mockAlerts('confirm');
    const view = await renderShellIn('ar', undefined, [DRAFT]);
    const send = jest.spyOn(view.letters, 'sendLetter');
    const push = jest.spyOn(view.drafts, 'push');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push(`/compose/${DRAFT.id}`));
    await waitFor(() =>
      expect(screen.getByTestId('compose-send').props.accessibilityState).toMatchObject({
        disabled: false,
      }),
    );
    await fireEvent.press(screen.getByTestId('compose-schedule-open'));
    expect(screen.getByText(ar.compose.scheduleConfirm)).toBeTruthy();

    // The default is 10-15 minutes ahead; 15 minutes earlier is always in the past.
    for (let i = 0; i < 3; i += 1) {
      await fireEvent.press(screen.getByTestId('schedule-minute-minus'));
    }
    expect(screen.getByTestId('compose-schedule-problem')).toHaveTextContent(PAST_MESSAGE);
    expect(screen.getByTestId('compose-schedule-confirm').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    // Back to a valid time: the hint clears and Schedule is enabled again.
    for (let i = 0; i < 3; i += 1) {
      await fireEvent.press(screen.getByTestId('schedule-minute-plus'));
    }
    expect(screen.queryByTestId('compose-schedule-problem')).toBeNull();

    // Time passes while the picker is open (no re-render): pressing Schedule must re-check the
    // clock, not trust the last render. Whichever way the screen reports it, nothing is sent.
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      jest.setSystemTime(Date.now() + 20 * 60_000);
    });
    await fireEvent.press(screen.getByTestId('compose-schedule-confirm'));
    await waitFor(() =>
      expect(
        screen.queryByTestId('compose-send-error') ??
          screen.getByTestId('compose-schedule-problem'),
      ).toHaveTextContent(PAST_MESSAGE),
    );
    expect(send).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled(); // rejected before any upload
    expect(alerts.shown).toHaveLength(0); // and before the confirmation dialog
    expect(screen.getByTestId('compose-screen')).toBeTruthy();
  });
});
