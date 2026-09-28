import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import type { LocalDraft } from '@/data/local/draftsStore';

import en from '../src/core/i18n/locales/en.json';
import { mockAlerts } from './helpers/alerts';
import { renderShellIn } from './helpers/renderShell';

const DRAFT: LocalDraft = {
  id: 'draft-offline',
  subject: null,
  body: 'Written offline',
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

describe('compose: send while the upload fails', () => {
  it('never calls send_letter, shows the generic error and keeps the draft', async () => {
    mockAlerts('confirm');
    const view = await renderShellIn('en', undefined, [DRAFT]);
    jest.spyOn(view.drafts, 'push').mockRejectedValue(new Error('Network request failed'));
    const send = jest.spyOn(view.letters, 'sendLetter');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push(`/compose/${DRAFT.id}`));
    await waitFor(() =>
      expect(screen.getByTestId('compose-send').props.accessibilityState).toMatchObject({
        disabled: false,
      }),
    );

    await fireEvent.press(screen.getByTestId('compose-send'));
    await waitFor(() =>
      expect(screen.getByTestId('compose-send-error')).toHaveTextContent(en.letters.error.unknown),
    );

    expect(send).not.toHaveBeenCalled();
    expect(await view.drafts.get(DRAFT.id)).not.toBeNull();
  });
});
