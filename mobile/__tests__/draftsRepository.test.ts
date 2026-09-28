import type { SupabaseClient } from '@supabase/supabase-js';

import type { LocalDraft } from '@/data/local/draftsStore';
import { createDraftsRepository, type DraftsOwnerStore } from '@/data/letters/draftsRepository';

import { createFakeDraftsStore } from './helpers/fakeDraftsStore';

interface FakeClientOptions {
  session?: { user: { id: string } } | null;
  /** Makes every update/insert fail with this error (e.g. offline). */
  writeError?: { message: string; code?: string } | null;
  remoteRows?: Record<string, unknown>[];
  /** Ids of existing server rows that are editable drafts of this user. */
  remoteDraftIds?: string[];
  /** Ids of existing server rows that are no longer drafts (RLS hides them from UPDATE). */
  remoteNonDraftIds?: string[];
  /** An id another session creates between our update and our insert (duplicate-key race). */
  createdConcurrently?: string;
}

/**
 * A fake Supabase client whose `letters` table behaves like the real one for draft pushes: UPDATE
 * only matches the user's draft rows (RLS), INSERT of an existing id fails with 23505. It records
 * the patches and rows written, so tests can check that id/sender_id are never updated.
 */
function fakeClient(opts: FakeClientOptions = {}) {
  const inserts: Record<string, unknown>[] = [];
  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  const deletedIds: string[] = [];
  const drafts = new Set(opts.remoteDraftIds ?? []);
  const nonDrafts = new Set(opts.remoteNonDraftIds ?? []);
  const client = {
    auth: {
      getSession: async () => ({ data: { session: opts.session ?? null } }),
    },
    from: (table: string) => {
      if (table !== 'letters') throw new Error(`unexpected table ${table}`);
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => ({
            select: () => {
              if (opts.writeError) return Promise.resolve({ data: null, error: opts.writeError });
              updates.push({ id, patch });
              return Promise.resolve({ data: drafts.has(id) ? [{ id }] : [], error: null });
            },
          }),
        }),
        insert: (row: Record<string, unknown>) => {
          if (opts.writeError) return Promise.resolve({ error: opts.writeError });
          const id = row.id as string;
          if (id === opts.createdConcurrently) drafts.add(id);
          if (drafts.has(id) || nonDrafts.has(id)) {
            return Promise.resolve({ error: { code: '23505', message: 'duplicate key' } });
          }
          inserts.push(row);
          drafts.add(id);
          return Promise.resolve({ error: null });
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
  return { client: client as unknown as SupabaseClient, inserts, updates, deletedIds };
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

  describe('push and forgetLocal', () => {
    const DRAFT: LocalDraft = {
      id: 'd1',
      subject: 'Hi',
      body: 'Hello',
      bodyDir: 'ltr',
      design: { v: 1 },
      recipientId: 'u2',
      dirty: true,
      updatedAt: 't',
    };

    function setup(clientOpts: FakeClientOptions = { session: { user: { id: 'me' } } }) {
      const store = createFakeDraftsStore([DRAFT]);
      const fake = fakeClient(clientOpts);
      const repo = createDraftsRepository({
        localStore: store,
        client: fake.client,
        generateId: () => 'unused',
        now: nextNow,
        fallbackDirection: FALLBACK,
      });
      return { store, repo, ...fake };
    }

    it('push uploads that one draft and marks it clean', async () => {
      const { repo, store, inserts } = setup();
      await repo.push('d1');
      expect(inserts).toEqual([
        {
          id: 'd1',
          sender_id: 'me',
          recipient_id: 'u2',
          subject: 'Hi',
          body: 'Hello',
          body_dir: 'ltr',
          design: { v: 1 },
        },
      ]);
      await expect(store.get('d1')).resolves.toEqual({ ...DRAFT, dirty: false });
    });

    it('push rejects when signed out, for an unknown id, and on an upload error, keeping the draft', async () => {
      const signedOut = setup({ session: null });
      await expect(signedOut.repo.push('d1')).rejects.toThrow();
      expect(signedOut.inserts).toEqual([]);

      const unknown = setup();
      await expect(unknown.repo.push('nope')).rejects.toThrow();
      expect(unknown.inserts).toEqual([]);

      const failing = setup({
        session: { user: { id: 'me' } },
        writeError: { message: 'offline' },
      });
      await expect(failing.repo.push('d1')).rejects.toThrow();
      await expect(failing.store.get('d1')).resolves.toEqual(DRAFT); // still dirty, still there
    });

    it('push edits an existing server draft with an update of the editable columns only', async () => {
      const { repo, inserts, updates } = setup({
        session: { user: { id: 'me' } },
        remoteDraftIds: ['d1'],
      });
      await repo.push('d1');
      expect(inserts).toEqual([]);
      expect(updates).toEqual([
        {
          id: 'd1',
          patch: {
            recipient_id: 'u2',
            subject: 'Hi',
            body: 'Hello',
            body_dir: 'ltr',
            design: { v: 1 },
          },
        },
      ]);
      // The column grants: id and sender_id are never part of an UPDATE.
      for (const { patch } of updates) {
        expect(patch).not.toHaveProperty('id');
        expect(patch).not.toHaveProperty('sender_id');
      }
    });

    it('push rejects for a letter that is no longer a draft, and never rewrites it', async () => {
      const { repo, store, inserts } = setup({
        session: { user: { id: 'me' } },
        remoteNonDraftIds: ['d1'],
      });
      await expect(repo.push('d1')).rejects.toThrow();
      expect(inserts).toEqual([]);
      await expect(store.get('d1')).resolves.toEqual(DRAFT); // still dirty locally
    });

    it('push survives the row being created concurrently: insert conflicts, then it updates', async () => {
      const { repo, store, updates } = setup({
        session: { user: { id: 'me' } },
        createdConcurrently: 'd1',
      });
      await repo.push('d1');
      expect(updates.map((u) => u.id)).toEqual(['d1', 'd1']); // before and after the conflict
      await expect(store.get('d1')).resolves.toEqual({ ...DRAFT, dirty: false });
    });

    it('forgetLocal removes only the local copy, never the server row', async () => {
      const { repo, store, deletedIds } = setup();
      await repo.forgetLocal('d1');
      await expect(store.get('d1')).resolves.toBeNull();
      expect(deletedIds).toEqual([]);
    });
  });

  describe('device ownership (privacy across accounts)', () => {
    const MINE: LocalDraft = {
      id: 'mine',
      subject: 'Private',
      body: 'Only for my eyes',
      bodyDir: 'ltr',
      design: {},
      recipientId: null,
      dirty: true,
      updatedAt: 't',
    };

    function memoryOwner(
      initial: string | null,
    ): DraftsOwnerStore & { value: () => string | null } {
      let owner = initial;
      return { get: () => owner, set: (v) => (owner = v), value: () => owner };
    }

    function setup(owner: string | null, clientOpts: FakeClientOptions = {}) {
      const store = createFakeDraftsStore([MINE]);
      const ownerStore = memoryOwner(owner);
      const fake = fakeClient(clientOpts);
      const repo = createDraftsRepository({
        localStore: store,
        client: fake.client,
        generateId: () => 'unused',
        now: nextNow,
        fallbackDirection: FALLBACK,
        ownerStore,
      });
      return { store, ownerStore, repo, ...fake };
    }

    it("deletes another account's drafts, unread, when a different account signs in", async () => {
      const { repo, store, ownerStore } = setup('alice');
      await repo.claimForUser('bob');
      await expect(store.list()).resolves.toEqual([]);
      expect(ownerStore.value()).toBe('bob');
    });

    it('keeps the drafts for the same account, and adopts them when no owner was recorded', async () => {
      const same = setup('alice');
      await same.repo.claimForUser('alice');
      await expect(same.store.list()).resolves.toEqual([MINE]);

      const unrecorded = setup(null);
      await unrecorded.repo.claimForUser('alice');
      await expect(unrecorded.store.list()).resolves.toEqual([MINE]);
      expect(unrecorded.ownerStore.value()).toBe('alice');
    });

    it('on sign-out: syncs unsent edits first, then clears the drafts and the owner', async () => {
      const { repo, store, ownerStore, inserts } = setup('alice', {
        session: { user: { id: 'alice' } },
      });
      await repo.releaseForSignOut();
      expect(inserts.map((row) => row.id)).toEqual(['mine']); // pushed before clearing
      await expect(store.list()).resolves.toEqual([]);
      expect(ownerStore.value()).toBeNull();
    });

    it('still clears on sign-out when the sync fails (offline)', async () => {
      const { repo, store } = setup('alice', {
        session: { user: { id: 'alice' } },
        writeError: { message: 'offline' },
      });
      await repo.releaseForSignOut();
      await expect(store.list()).resolves.toEqual([]);
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
      const { client, inserts, updates } = fakeClient({ session: null });
      const repo = createDraftsRepository({
        localStore: store,
        client,
        generateId: () => 'unused',
        now: nextNow,
        fallbackDirection: FALLBACK,
      });

      await expect(repo.sync()).resolves.toEqual({ pushed: 0, pulled: 0, failed: 0 });
      expect(inserts).toEqual([]);
      expect(updates).toEqual([]);
    });

    it('pushes every dirty draft and marks it clean on success', async () => {
      const store = createFakeDraftsStore([
        localDraft({ id: 'd1', dirty: true }),
        localDraft({ id: 'd2', dirty: false }), // not dirty: skipped
      ]);
      const { client, inserts } = fakeClient({ session: { user: { id: 'user-1' } } });
      const repo = createDraftsRepository({
        localStore: store,
        client,
        generateId: () => 'unused',
        now: nextNow,
        fallbackDirection: FALLBACK,
      });

      const result = await repo.sync();
      expect(result).toEqual({ pushed: 1, pulled: 0, failed: 0 });
      expect(inserts).toEqual([
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
        writeError: { message: 'network down' },
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

      // The push above succeeds (writeError not set), so this draft is pushed and excluded from
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
