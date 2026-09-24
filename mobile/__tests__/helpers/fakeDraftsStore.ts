import type { LocalDraft, LocalDraftsStore } from '@/data/local/draftsStore';

/** In-memory `LocalDraftsStore` for tests, mirroring fakeAuthRepository.ts's style. */
export function createFakeDraftsStore(initial: LocalDraft[] = []): LocalDraftsStore {
  const rows = new Map(initial.map((d) => [d.id, d]));
  return {
    async list() {
      return [...rows.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async upsert(draft) {
      rows.set(draft.id, draft);
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}
