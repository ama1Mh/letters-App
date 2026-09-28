import {
  LetterActionError,
  type InboxItem,
  type Letter,
  type LetterErrorCode,
  type LettersRepository,
  type SentItem,
  type SentKind,
} from '@/data/letters/lettersRepository';

export interface FakeLettersOptions {
  inbox?: InboxItem[];
  sent?: Partial<Record<SentKind, SentItem[]>>;
  letters?: Letter[];
  fail?: Partial<Record<keyof LettersRepository, LetterErrorCode>>;
  /** Fixed "now" for delivered_at / read_at values the fake invents. */
  now?: string;
}

export type FakeLettersCall =
  | { method: 'sendLetter'; letterId: string; scheduledAt: string | null }
  | { method: 'unscheduleLetter' | 'markRead' | 'getLetter'; letterId: string }
  | { method: 'listInbox' }
  | { method: 'listSent'; kind: SentKind };

export type FakeLettersRepository = LettersRepository & { calls: FakeLettersCall[] };

/**
 * In-memory LettersRepository for tests, mirroring fakeDiscoveryRepository.ts's style. Lists return
 * everything in one page (paging itself is covered by lettersRepository.test.ts and
 * usePagedList.test.ts); markRead() updates both the letter and its inbox row; `calls` records every
 * method call in order.
 */
export function createFakeLettersRepository(
  options: FakeLettersOptions = {},
): FakeLettersRepository {
  const now = options.now ?? '2026-09-29T10:00:00.000Z';
  const calls: FakeLettersCall[] = [];
  const letters = new Map((options.letters ?? []).map((l) => [l.id, l]));
  let inbox = [...(options.inbox ?? [])];

  function maybeThrow(method: keyof LettersRepository) {
    const code = options.fail?.[method];
    if (code) throw new LetterActionError(code);
  }

  return {
    calls,
    async sendLetter(letterId, scheduledAt) {
      const at = scheduledAt ? scheduledAt.toISOString() : null;
      calls.push({ method: 'sendLetter', letterId, scheduledAt: at });
      maybeThrow('sendLetter');
      return at
        ? { status: 'scheduled', scheduledAt: at, deliveredAt: null }
        : { status: 'delivered', scheduledAt: null, deliveredAt: now };
    },
    async unscheduleLetter(letterId) {
      calls.push({ method: 'unscheduleLetter', letterId });
      maybeThrow('unscheduleLetter');
      return { status: 'draft', scheduledAt: null, deliveredAt: null };
    },
    async markRead(letterId) {
      calls.push({ method: 'markRead', letterId });
      maybeThrow('markRead');
      // Like the server: the first read sticks, and the inbox row reflects it.
      const readAt = letters.get(letterId)?.readAt ?? now;
      const letter = letters.get(letterId);
      if (letter) letters.set(letterId, { ...letter, readAt });
      inbox = inbox.map((item) => (item.id === letterId ? { ...item, readAt } : item));
      return readAt;
    },
    async listInbox() {
      calls.push({ method: 'listInbox' });
      maybeThrow('listInbox');
      return { items: inbox, nextCursor: null };
    },
    async listSent(kind) {
      calls.push({ method: 'listSent', kind });
      maybeThrow('listSent');
      return { items: options.sent?.[kind] ?? [], nextCursor: null };
    },
    async getLetter(letterId) {
      calls.push({ method: 'getLetter', letterId });
      maybeThrow('getLetter');
      const letter = letters.get(letterId);
      if (!letter) throw new LetterActionError('not_found');
      return letter;
    },
  };
}
