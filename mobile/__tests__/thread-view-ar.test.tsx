import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import type { ThreadItem } from '@/data/letters/lettersRepository';

import ar from '../src/core/i18n/locales/ar.json';
import { SARA } from './helpers/letterFixtures';
import { renderShellIn } from './helpers/renderShell';

function item(overrides: Partial<ThreadItem> & { id: string }): ThreadItem {
  return {
    threadId: 'root',
    parentLetterId: null,
    subject: null,
    preview: 'preview',
    bodyDir: 'ltr',
    status: 'delivered',
    scheduledAt: null,
    deliveredAt: '2026-09-28T09:00:00.000Z',
    readAt: null,
    sortAt: '2026-09-28T09:00:00.000Z',
    isMine: false,
    other: SARA,
    ...overrides,
  };
}

describe('Conversation view (ar/RTL)', () => {
  it('lists the thread oldest first, mine vs theirs, and replies to the latest received letter', async () => {
    const view = await renderShellIn(
      'ar',
      undefined,
      [],
      {},
      {
        threads: {
          root: [
            item({ id: 'root', preview: 'مرحبا', bodyDir: 'rtl' }),
            item({
              id: 'my-reply',
              parentLetterId: 'root',
              isMine: true,
              readAt: '2026-09-28T11:00:00.000Z',
              deliveredAt: '2026-09-28T10:00:00.000Z',
              sortAt: '2026-09-28T10:00:00.000Z',
            }),
            item({
              id: 'her-answer',
              parentLetterId: 'my-reply',
              deliveredAt: '2026-09-28T12:00:00.000Z',
              sortAt: '2026-09-28T12:00:00.000Z',
            }),
          ],
        },
      },
    );

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/thread/root'));
    await waitFor(() => expect(screen.getByTestId('thread-screen')).toBeTruthy());

    expect(screen.getByTestId('thread-item-my-reply').props.accessibilityHint).toBe(ar.thread.mine);
    expect(screen.getByTestId('thread-item-root').props.accessibilityHint).toBe(ar.thread.theirs);
    expect(screen.getByTestId('thread-item-my-reply-read')).toHaveTextContent(ar.sent.read);
    expect(screen.queryByTestId('thread-item-root-read')).toBeNull();
    expect(screen.getByTestId('thread-item-root-when')).not.toHaveTextContent(/[٠-٩]/);

    await fireEvent.press(screen.getByTestId('thread-reply'));
    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());
    const drafts = await view.drafts.list();
    expect(drafts).toHaveLength(1);
    // The latest letter I received, not the thread root.
    expect(drafts[0]).toMatchObject({ parentLetterId: 'her-answer', recipientId: SARA.id });
  });
});
