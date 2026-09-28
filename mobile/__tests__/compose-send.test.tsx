import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import type { LocalDraft } from '@/data/local/draftsStore';

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
  it('pushes the draft, sends it once, drops only the local copy and lands on Sent', async () => {
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

    await fireEvent.press(screen.getByTestId('compose-send'));
    await waitFor(() => expect(screen.getByTestId('sent-screen')).toBeTruthy());

    expect(push).toHaveBeenCalledWith(DRAFT.id);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(DRAFT.id);
    // Upload first, then send, then forget: the server copy must match before send_letter.
    expect(push.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]);
    expect(send.mock.invocationCallOrder[0]).toBeLessThan(forgetLocal.mock.invocationCallOrder[0]);
    expect(remove).not.toHaveBeenCalled(); // remove() would also delete the server row
    expect(await view.drafts.get(DRAFT.id)).toBeNull();
  });
});
