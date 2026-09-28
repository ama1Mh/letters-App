import type { Correspondent, InboxItem, Letter, SentItem } from '@/data/letters/lettersRepository';
import { defaultDesign } from '@/domain/design';

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

export const ME: Correspondent = {
  id: 'user-shell',
  username: 'shell_user',
  displayName: 'Shell User',
  avatarKey: null,
};

/** An unread InboxItem from Sara unless overridden. */
export function inboxItem(overrides: Partial<InboxItem> & { id: string }): InboxItem {
  return {
    threadId: `thread-${overrides.id}`,
    subject: 'Hello',
    preview: 'Hello there',
    bodyDir: 'ltr',
    deliveredAt: '2026-09-28T09:30:00.000Z',
    readAt: null,
    sortAt: overrides.deliveredAt ?? '2026-09-28T09:30:00.000Z',
    sender: SARA,
    ...overrides,
  };
}

/** A delivered letter from Sara to me, viewed by me (the recipient), unless overridden. */
export function letter(overrides: Partial<Letter> & { id: string }): Letter {
  return {
    threadId: `thread-${overrides.id}`,
    parentLetterId: null,
    subject: 'Hello',
    body: 'Hello there, this is the full letter.',
    bodyDir: 'ltr',
    design: defaultDesign(),
    status: 'delivered',
    scheduledAt: null,
    deliveredAt: '2026-09-28T09:30:00.000Z',
    readAt: null,
    viewerRole: 'recipient',
    sender: SARA,
    recipient: ME,
    ...overrides,
  };
}
