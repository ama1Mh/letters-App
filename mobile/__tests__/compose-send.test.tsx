import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import type { LocalDraft } from '@/data/local/draftsStore';

import en from '../src/core/i18n/locales/en.json';
import { mockAlerts } from './helpers/alerts';
import { renderShellIn } from './helpers/renderShell';

const DRAFT: LocalDraft = {
  id: 'draft-send',
  subject: 'Hello',
  body: 'A letter worth sending',
  bodyDir: 'ltr',
  design: {
    v: 1,
    paper: 'cream',
    font: 'caveat',
    ink: 'classic_black',
    layout: 'standard',
    stamp: null,
    stickers: [],
  },
  recipientId: 'user-everyone',
  dirty: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('compose: send now', () => {
  it('asks first; Cancel sends nothing, Send pushes, sends once, drops only the local copy and lands on Sent', async () => {
    const alerts = mockAlerts('cancel');
    const view = await renderShellIn('en', undefined, [DRAFT]);
    const push = jest.spyOn(view.drafts, 'push');
    const forgetLocal = jest.spyOn(view.drafts, 'forgetLocal');
    const remove = jest.spyOn(view.drafts, 'remove');
    const send = jest.spyOn(view.letters, 'sendLetter');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push(`/compose/${DRAFT.id}`));
    await waitFor(() =>
      expect(screen.getByTestId('compose-send').props.accessibilityState).toMatchObject({
        disabled: false,
      }),
    );

    // Cancel in the confirmation: nothing is uploaded or sent, and we stay on compose.
    await fireEvent.press(screen.getByTestId('compose-send'));
    expect(alerts.shown).toHaveLength(1);
    expect(alerts.shown[0].title).toBe(en.compose.sendConfirmTitle);
    expect(alerts.shown[0].message).toBe(en.compose.sendConfirmMessage);
    expect(push).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByTestId('compose-screen')).toBeTruthy();

    alerts.choose('confirm');
    await fireEvent.press(screen.getByTestId('compose-send'));
    await waitFor(() => expect(screen.getByTestId('sent-screen')).toBeTruthy());
    expect(screen.getByTestId('sent-switch-sent').props.accessibilityState).toMatchObject({
      selected: true,
    });

    expect(push).toHaveBeenCalledWith(DRAFT.id);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(DRAFT.id, null); // null = send now
    // Upload first, then send, then forget: the server copy must match before send_letter.
    expect(push.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]);
    expect(send.mock.invocationCallOrder[0]).toBeLessThan(forgetLocal.mock.invocationCallOrder[0]);
    expect(remove).not.toHaveBeenCalled(); // remove() would also delete the server row
    expect(await view.drafts.get(DRAFT.id)).toBeNull();
  });
});
