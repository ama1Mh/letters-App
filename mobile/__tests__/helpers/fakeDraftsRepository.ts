import type { DraftsRepository, DraftInput } from '@/data/letters/draftsRepository';
import type { LocalDraft } from '@/data/local/draftsStore';

/** In-memory `DraftsRepository` for component tests. sync() is a no-op (component tests exercise
 *  save/list/remove only); draftsRepository.test.ts covers sync() itself against the real logic. */
export function createFakeDraftsRepository(initial: LocalDraft[] = []): DraftsRepository {
  const rows = new Map(initial.map((d) => [d.id, d]));
  let nextId = 0;

  return {
    async list() {
      return [...rows.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async save(input: DraftInput) {
      nextId += 1;
      const draft: LocalDraft = {
        id: input.id ?? `fake-draft-${nextId}`,
        subject: input.subject,
        body: input.body,
        bodyDir: 'ltr',
        design: input.design,
        recipientId: input.recipientId,
        dirty: true,
        updatedAt: new Date(2026, 0, 1, 0, 0, nextId).toISOString(),
      };
      rows.set(draft.id, draft);
      return draft;
    },
    async remove(id) {
      rows.delete(id);
    },
    async sync() {
      return { pushed: 0, pulled: 0, failed: 0 };
    },
  };
}
