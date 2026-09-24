import type { SupabaseClient } from '@supabase/supabase-js';

import type { LocalDraft } from '@/data/local/draftsStore';
import { createDraftsRepository } from '@/data/letters/draftsRepository';

import { createFakeDraftsStore } from './helpers/fakeDraftsStore';

interface FakeClientOptions {
  session?: { user: { id: string } } | null;
  upsertError?: { message: string } | null;
  remoteRows?: Record<string, unknown>[];
}

function fakeClient(opts: FakeClientOptions = {}) {
  const upserts: unknown[] = [];
  const deletedIds: string[] = [];
  const client = {
    auth: {
      getSession: async () => ({ data: { session: opts.session ?? null } }),
    },
    from: (table: string) => {
      if (table !== 'letters') throw new Error(`unexpected table ${table}`);
      return {
        upsert: (row: unknown) => {
          upserts.push(row);
          return Promise.resolve({ error: opts.upsertError ?? null });
        },
        delete: () => ({
          eq: (_col: string, value: string) => {
            deletedIds.push(value);
            return Promise.resolve({ error: null });
          },
        }),
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: opts.remoteRows ?? [], error: null }),
          }),
        }),
      };
    },
  };
  return { client: client as unknown as SupabaseClient, upserts, deletedIds };
}

const FALLBACK = () => 'ltr' as const;
let tick = 0;
function nextNow() {
  tick += 1;
  return `2026-01-01T00:00:0${tick}.000Z`;
}

describe('createDraftsRepository', () => {
  describe('save', () => {
    it('generates an id, computes bodyDir, and marks the draft dirty', async () => {
      const store = createFakeDraftsStore();
      const { client } = fakeClient();
      const repo = createDraftsRepository({
        localStore: store,
        client,
        generateId: () => 'draft-1',
        now: nextNow,
        fallbackDirection: FALLBACK,
      });

      const draft = await repo.save({
        subject: 'Hi',
        body: 'مرحبا',
        design: {},
        recipientId: null,
      });
      expect(draft).toEqual({
        id: 'draft-1',
        subject: 'Hi',
        body: 'مرحبا',
        bodyDir: 'rtl',
        design: {},
        recipientId: null,
        dirty: true,
        updatedAt: '2026-01-01T00:00:01.000Z',
      });
      await expect(store.get('draft-1')).resolves.toEqual(draft);
    });

    it('reuses a provided id to overwrite an existing draft, falling back to ltr with no strong character', async () => {
      const store = createFakeDraftsStore();
      const repo = createDraftsRepository({
        localStore: store,
        client: fakeClient().client,
        generateId: () => 'unused',
        now: nextNow,
        fallbackDirection: FALLBACK,
      });

      await repo.save({
        id: 'draft-2',
        subject: null,
        body: 'first',
        design: {},
        recipientId: null,
      });
      const updated = await repo.save({
        id: 'draft-2',
        subject: 'now with a subject',
        body: '123',
        design: { v: 1 },
        recipientId: 'user-9',
      });

      expect(updated.id).toBe('draft-2');
      expect(updated.bodyDir).toBe('ltr'); // "123" has no strong character; falls back
      await expect(store.list()).resolves.toEqual([updated]); // one row, not two
    });
  });

  describe('remove', () => {
    it('deletes locally and best-effort remotely', async () => {
      const store = createFakeDraftsStore([
        {
          id: 'd1',
          subject: null,
          body: 'x',
          bodyDir: 'ltr',
          design: {},
          recipientId: null,
          dirty: true,
          updatedAt: 't',
        },
      ]);
      const { client, deletedIds } = fakeClient();
      const repo = createDraftsRepository({
        localStore: store,
        client,
        generateId: () => 'unused',
        now: nextNow,
        fallbackDirection: FALLBACK,
      });

      await repo.remove('d1');
      await expect(store.get('d1')).resolves.toBeNull();
      expect(deletedIds).toEqual(['d1']);
    });
  });

  describe('sync', () => {
    function localDraft(overrides: Partial<LocalDraft>): LocalDraft {
      return {
        id: 'd1',
        subject: null,
        body: 'x',
        bodyDir: 'ltr',
        design: {},
        recipientId: null,
        dirty: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
      };
    }

    it('does nothing and touches no network beyond getSession when there is no session', async () => {
      const store = createFakeDraftsStore([localDraft({ dirty: true })]);
      const { client, upserts } = fakeClient({ session: null });
      const repo = createDraftsRepository({
        localStore: store,
        client,
        generateId: () => 'unused',
        now: nextNow,
        fallbackDirection: FALLBACK,
      });

      await expect(repo.sync()).resolves.toEqual({ pushed: 0, pulled: 0, failed: 0 });
      expect(upserts).toEqual([]);
    });

    it('pushes every dirty draft and marks it clean on success', async () => {
      const store = createFakeDraftsStore([
        localDraft({ id: 'd1', dirty: true }),
        localDraft({ id: 'd2', dirty: false }), // not dirty: skipped
      ]);
      const { client, upserts } = fakeClient({ session: { user: { id: 'user-1' } } });
      const repo = createDraftsRepository({
        localStore: store,
        client,
        generateId: () => 'unused',
        now: nextNow,
        fallbackDirection: FALLBACK,
      });

      const result = await repo.sync();
      expect(result).toEqual({ pushed: 1, pulled: 0, failed: 0 });
      expect(upserts).toEqual([
        {
          id: 'd1',
          sender_id: 'user-1',
          recipient_id: null,
          subject: null,
          body: 'x',
          body_dir: 'ltr',
          design: {},
        },
      ]);
      await expect(store.get('d1')).resolves.toMatchObject({ dirty: false });
    });

    it('counts a push failure without throwing, and leaves that draft dirty', async () => {
      const store = createFakeDraftsStore([localDraft({ id: 'd1', dirty: true })]);
      const { client } = fakeClient({
        session: { user: { id: 'user-1' } },
        upsertError: { message: 'network down' },
      });
      const repo = createDraftsRepository({
        localStore: store,
        client,
        generateId: () => 'unused',
        now: nextNow,
        fallbackDirection: FALLBACK,
      });

      await expect(repo.sync()).resolves.toEqual({ pushed: 0, pulled: 0, failed: 1 });
      await expect(store.get('d1')).resolves.toMatchObject({ dirty: true });
    });

    it('pulls a remote draft that has no local match', async () => {
      const store = createFakeDraftsStore();
      const { client } = fakeClient({
        session: { user: { id: 'user-1' } },
        remoteRows: [
          {
            id: 'remote-1',
            subject: 'From another device',
            body: 'مرحبا',
            body_dir: 'rtl',
            design: { v: 1 },
            recipient_id: null,
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      });
      const repo = createDraftsRepository({
        localStore: store,
        client,
        generateId: () => 'unused',
        now: nextNow,
        fallbackDirection: FALLBACK,
      });

      const result = await repo.sync();
      expect(result).toEqual({ pushed: 0, pulled: 1, failed: 0 });
      await expect(store.get('remote-1')).resolves.toEqual({
        id: 'remote-1',
        subject: 'From another device',
        body: 'مرحبا',
        bodyDir: 'rtl',
        design: { v: 1 },
        recipientId: null,
        dirty: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('never overwrites a dirty local draft, even if the remote row for the same id is newer', async () => {
      const store = createFakeDraftsStore([
        localDraft({
          id: 'd1',
          body: 'local edit',
          dirty: true,
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
      ]);
      const { client } = fakeClient({
        session: { user: { id: 'user-1' } },
        remoteRows: [
          {
            id: 'd1',
            subject: null,
            body: 'remote edit',
            body_dir: 'ltr',
            design: {},
            recipient_id: null,
            updated_at: '2026-01-01T00:05:00.000Z', // newer than local, but local is dirty
          },
        ],
      });
      const repo = createDraftsRepository({
        localStore: store,
        client,
        generateId: () => 'unused',
        now: nextNow,
        fallbackDirection: FALLBACK,
      });

      // The push above succeeds (upsertError not set), so this draft is pushed and excluded from
      // the pull merge outright - not just protected by the dirty check, which by the time pull
      // runs would no longer apply (the push already cleared it).
      const result = await repo.sync();
      expect(result).toEqual({ pushed: 1, pulled: 0, failed: 0 });
      await expect(store.get('d1')).resolves.toMatchObject({ body: 'local edit', dirty: false });
    });

    it('overwrites a clean local draft when the remote row is newer, but not when it is not', async () => {
      const store = createFakeDraftsStore([
        localDraft({ id: 'older', dirty: false, updatedAt: '2026-01-01T00:00:00.000Z' }),
        localDraft({ id: 'same-or-newer', dirty: false, updatedAt: '2026-01-01T00:10:00.000Z' }),
      ]);
      const { client } = fakeClient({
        session: { user: { id: 'user-1' } },
        remoteRows: [
          {
            id: 'older',
            subject: 'Updated remotely',
            body: 'newer body',
            body_dir: 'ltr',
            design: {},
            recipient_id: null,
            updated_at: '2026-01-01T00:05:00.000Z',
          },
          {
            id: 'same-or-newer',
            subject: 'Should not apply',
            body: 'stale',
            body_dir: 'ltr',
            design: {},
            recipient_id: null,
            updated_at: '2026-01-01T00:01:00.000Z', // older than local
          },
        ],
      });
      const repo = createDraftsRepository({
        localStore: store,
        client,
        generateId: () => 'unused',
        now: nextNow,
        fallbackDirection: FALLBACK,
      });

      const result = await repo.sync();
      expect(result.pulled).toBe(1);
      await expect(store.get('older')).resolves.toMatchObject({ body: 'newer body' });
      await expect(store.get('same-or-newer')).resolves.toMatchObject({ body: 'x' }); // unchanged
    });
  });
});
