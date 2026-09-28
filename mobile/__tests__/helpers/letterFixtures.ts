import type { Correspondent, SentItem } from '@/data/letters/lettersRepository';

export const SARA: Correspondent = {
  id: 'user-sara',
  username: 'sara',
  displayName: 'Sara',
  avatarKey: null,
};

export const DELETED: Correspondent = {
  id: 'user-gone',
  username: null,
  displayName: null,
  avatarKey: null,
};

/** A SentItem with sensible defaults for a delivered letter; override what the test cares about. */
export function sentItem(overrides: Partial<SentItem> & { id: string }): SentItem {
  return {
    threadId: `thread-${overrides.id}`,
    subject: null,
    preview: 'Hello there',
    bodyDir: 'ltr',
    status: 'delivered',
    scheduledAt: null,
    deliveredAt: '2026-09-28T09:30:00.000Z',
    readAt: null,
    sortAt: overrides.deliveredAt ?? overrides.scheduledAt ?? '2026-09-28T09:30:00.000Z',
    recipient: SARA,
    ...overrides,
  };
}
