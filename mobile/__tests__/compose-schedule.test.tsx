import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import type { LocalDraft } from '@/data/local/draftsStore';
import { addDays, defaultScheduleTime } from '@/domain/schedule';

import en from '../src/core/i18n/locales/en.json';
import { mockAlerts } from './helpers/alerts';
import { renderShellIn } from './helpers/renderShell';

const DRAFT: LocalDraft = {
  id: 'draft-later',
  subject: 'For tomorrow',
  body: 'See you soon',
  bodyDir: 'ltr',
  design: {
    v: 2,
    paper: 'aged_cream',
    font: 'caveat',
    ink: 'black',
    textSize: 'm',
    layout: 'standard',
    elements: [],
  },
  recipientId: 'user-everyone',
  dirty: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('compose: schedule send', () => {
  it('opens the picker at the default time, moves it a day later and schedules that exact time', async () => {
    const alerts = mockAlerts('confirm');
    const view = await renderShellIn('en', undefined, [DRAFT]);
    const send = jest.spyOn(view.letters, 'sendLetter');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push(`/compose/${DRAFT.id}`));
    await waitFor(() =>
      expect(screen.getByTestId('compose-send').props.accessibilityState).toMatchObject({
        disabled: false,
      }),
    );

    // renderRouter() fakes the clock, so Date.now() is stable here: the default the screen computes
    // on press is the one computed right after it.
    await fireEvent.press(screen.getByTestId('compose-schedule-open'));
    const expectedDefault = defaultScheduleTime(new Date());
    expect(screen.getByTestId('compose-schedule-picker')).toBeTruthy();
    expect(screen.queryByTestId('compose-send')).toBeNull(); // replaced by Schedule/Cancel
    expect(screen.queryByTestId('compose-schedule-problem')).toBeNull();

    await fireEvent.press(screen.getByTestId('schedule-day-plus'));
    await fireEvent.press(screen.getByTestId('compose-schedule-confirm'));
    await waitFor(() => expect(screen.getByTestId('sent-screen')).toBeTruthy());
    // Lands on the Scheduled view, where the new letter is.
    expect(screen.getByTestId('sent-switch-scheduled').props.accessibilityState).toMatchObject({
      selected: true,
    });

    // The confirmation named the exact day being scheduled.
    const scheduled = addDays(expectedDefault, 1);
    expect(alerts.shown).toHaveLength(1);
    expect(alerts.shown[0].title).toBe(en.compose.scheduleConfirmTitle);
    expect(alerts.shown[0].message).toContain(String(scheduled.getFullYear()));
    expect(alerts.shown[0].message).toContain(String(scheduled.getDate()));

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(DRAFT.id, addDays(expectedDefault, 1));
    expect(await view.drafts.get(DRAFT.id)).toBeNull();
  });
});
