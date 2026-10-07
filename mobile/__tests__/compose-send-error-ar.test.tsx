import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import type { LocalDraft } from '@/data/local/draftsStore';

import ar from '../src/core/i18n/locales/ar.json';
import { mockAlerts } from './helpers/alerts';
import { renderShellIn } from './helpers/renderShell';

const DRAFT: LocalDraft = {
  id: 'draft-blocked',
  subject: null,
  body: '',
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
  recipientId: 'user-invite-only',
  dirty: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('compose: send failure (ar/RTL)', () => {
  it('disables Send without a body, then shows the neutral Arabic error and keeps the draft', async () => {
    const alerts = mockAlerts('confirm');
    const view = await renderShellIn(
      'ar',
      undefined,
      [DRAFT],
      {},
      { fail: { sendLetter: 'cannot_send' } },
    );
    const forgetLocal = jest.spyOn(view.drafts, 'forgetLocal');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push(`/compose/${DRAFT.id}`));
    await waitFor(() => expect(screen.getByTestId('compose-send')).toBeTruthy());
    expect(screen.getByTestId('compose-send').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByText(ar.compose.send)).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('compose-body'), 'رسالة');
    await waitFor(() =>
      expect(screen.getByTestId('compose-send').props.accessibilityState).toMatchObject({
        disabled: false,
      }),
    );

    await fireEvent.press(screen.getByTestId('compose-send'));
    expect(alerts.shown[0].title).toBe(ar.compose.sendConfirmTitle);
    await waitFor(() =>
      expect(screen.getByTestId('compose-send-error')).toHaveTextContent(
        ar.letters.error.cannot_send,
      ),
    );

    expect(screen.getByTestId('compose-screen')).toBeTruthy(); // stayed on compose
    expect(forgetLocal).not.toHaveBeenCalled();
    expect((await view.drafts.get(DRAFT.id))?.body).toBe('رسالة'); // the typed text was kept
    expect(screen.getByTestId('compose-send').props.accessibilityState).toMatchObject({
      disabled: false,
    }); // can retry
  });
});
