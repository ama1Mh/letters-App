/**
 * Bridges the local drafts store and the remote `letters` table (PLAN §4.3). `save()` writes
 * locally only - fast and offline-capable, what debounced autosave calls on every change; `sync()`
 * is a separate step (called on e.g. screen focus or connectivity regained) that pushes dirty local
 * drafts up and pulls the sender's remote draft rows down, last-write-wins by `updatedAt`.
 *
 * `createDraftsRepository()` takes every dependency injected (the same pattern as the rest of
 * `data/`), so it is unit-tested without expo-sqlite, expo-crypto or a live Supabase client;
 * `getDraftsRepository()` at the bottom wires the real ones.
 *
 * Known simplification (documented, not silently skipped): `remove()` deletes locally immediately
 * and best-effort remotely. If the remote delete fails while offline, a later sync()'s pull step
 * could re-download the row - e.g. from another signed-in session that still has it - and
 * "resurrect" a draft the user already deleted. Proper tombstone tracking (a deleted-drafts log) is
 * deferred; see DECISIONS.md.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';

import { isLayoutRtl } from '../../core/i18n/direction';
import { detectBodyDirection, type TextDirection } from '../../domain/bodyDirection';
import { nativeDraftsStore } from '../local/nativeDraftsStore';
import type { LocalDraft, LocalDraftsStore } from '../local/draftsStore';
import { getSupabase } from '../supabase';

export interface DraftInput {
  /** Omitted for a new draft: the repository generates one and uses it as both the local id and,
   *  once synced, the remote `letters.id` (PLAN §4.3; DEC, see the letters migration). */
  id?: string;
  subject: string | null;
  body: string;
  design: unknown;
  recipientId: string | null;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  /** Individual pushes that failed (e.g. offline partway through); sync() still resolves. */
  failed: number;
}

export interface DraftsRepository {
  list(): Promise<LocalDraft[]>;
  get(id: string): Promise<LocalDraft | null>;
  save(input: DraftInput): Promise<LocalDraft>;
  remove(id: string): Promise<void>;
  sync(): Promise<SyncResult>;
  /** Uploads one local draft now (not waiting for sync()), so the server copy matches before
   *  `send_letter`. Rejects if signed out, if the draft is not stored locally, or if the upload
   *  fails (e.g. offline); the local draft is kept either way. */
  push(id: string): Promise<void>;
  /** Removes the local copy only, never the server row: used after a successful send, when the
   *  server row is no longer a draft (so sync()'s pull, which only reads drafts, won't bring it
   *  back). Unlike remove(), which also deletes the remote draft. */
  forgetLocal(id: string): Promise<void>;
}

interface LetterDraftRow {
  id: string;
  subject: string | null;
  body: string;
  body_dir: string;
  design: unknown;
  recipient_id: string | null;
  updated_at: string;
}

function toRemoteRow(draft: LocalDraft, senderId: string) {
  return {
    id: draft.id,
    sender_id: senderId,
    recipient_id: draft.recipientId,
    subject: draft.subject,
    body: draft.body,
    body_dir: draft.bodyDir,
    design: draft.design,
  };
}

/** The columns `authenticated` may UPDATE on a draft (column grants in the letters migration). */
function editableColumns(draft: LocalDraft) {
  return {
    recipient_id: draft.recipientId,
    subject: draft.subject,
    body: draft.body,
    body_dir: draft.bodyDir,
    design: draft.design,
  };
}

/**
 * Uploads one local draft. Not an upsert: PostgREST's upsert is `INSERT ... ON CONFLICT DO UPDATE`
 * that SETs every column, including `id` and `sender_id`, which `authenticated` deliberately may
 * not update (column grants), so the server refuses it with 42501 (found on the device, Phase 6
 * M8). Instead: update the editable columns of an existing draft; if no draft row matched, insert
 * the full row; if that insert hits a duplicate key (the row was created meanwhile, e.g. from
 * another session), update once more. A letter that is no longer a draft is invisible to the
 * update (RLS: drafts only) and makes the insert conflict, so it rejects rather than being edited.
 */
/** PostgREST errors are plain objects; rethrow as an Error (message and code only, no content). */
function pushFailed(error: { message: string; code?: string }): Error {
  return new Error(`push failed${error.code ? ` (${error.code})` : ''}: ${error.message}`);
}

async function pushDraft(client: SupabaseClient, draft: LocalDraft, senderId: string) {
  const update = () =>
    client.from('letters').update(editableColumns(draft)).eq('id', draft.id).select('id');

  const first = await update();
  if (first.error) throw pushFailed(first.error);
  if ((first.data ?? []).length > 0) return;

  const inserted = await client.from('letters').insert(toRemoteRow(draft, senderId));
  if (!inserted.error) return;
  if (inserted.error.code !== '23505') throw pushFailed(inserted.error);

  const retried = await update();
  if (retried.error) throw pushFailed(retried.error);
  if ((retried.data ?? []).length === 0) {
    throw new Error('push: the server row exists but is not an editable draft');
  }
}

function fromRemoteRow(row: LetterDraftRow): LocalDraft {
  return {
    id: row.id,
    subject: row.subject,
    body: row.body,
    bodyDir: row.body_dir === 'rtl' ? 'rtl' : 'ltr',
    design: row.design,
    recipientId: row.recipient_id,
    dirty: false,
    updatedAt: row.updated_at,
  };
}

export interface DraftsRepositoryOptions {
  localStore: LocalDraftsStore;
  client: SupabaseClient;
  generateId: () => string;
  now: () => string;
  /** detectBodyDirection()'s fallback: the sender's current UI direction (PLAN §3.5). */
  fallbackDirection: () => TextDirection;
}

/** Pure of native modules: every dependency is injected. */
export function createDraftsRepository(options: DraftsRepositoryOptions): DraftsRepository {
  const { localStore, client, generateId, now, fallbackDirection } = options;

  return {
    list: () => localStore.list(),
    get: (id) => localStore.get(id),

    async save(input) {
      const draft: LocalDraft = {
        id: input.id ?? generateId(),
        subject: input.subject,
        body: input.body,
        bodyDir: detectBodyDirection(input.body, fallbackDirection()),
        design: input.design,
        recipientId: input.recipientId,
        dirty: true,
        updatedAt: now(),
      };
      await localStore.upsert(draft);
      return draft;
    },

    async remove(id) {
      await localStore.remove(id);
      try {
        await client.from('letters').delete().eq('id', id);
      } catch {
        // Best effort; see the file header comment for the known resurrection edge case.
      }
    },

    async push(id) {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session) throw new Error('push: not signed in');
      const draft = await localStore.get(id);
      if (!draft) throw new Error('push: draft not found locally');
      await pushDraft(client, draft, session.user.id);
      await localStore.upsert({ ...draft, dirty: false });
    },

    forgetLocal: (id) => localStore.remove(id),

    async sync() {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session) return { pushed: 0, pulled: 0, failed: 0 };
      const senderId = session.user.id;

      // Ids pushed successfully this round are excluded from the pull merge below entirely, not
      // just protected by the dirty check: we already know local is authoritative for them, having
      // just written it, and a pulled read of our own fresh write reflecting the server's own
      // updated_at (set by the letters_set_updated_at trigger, not the value we sent) could
      // otherwise look "newer" than the local timestamp and cause a pointless immediate re-merge.
      const justPushed = new Set<string>();
      let pushed = 0;
      let failed = 0;
      for (const draft of await localStore.list()) {
        if (!draft.dirty) continue;
        try {
          await pushDraft(client, draft, senderId);
          await localStore.upsert({ ...draft, dirty: false });
          justPushed.add(draft.id);
          pushed += 1;
        } catch {
          failed += 1;
        }
      }

      let pulled = 0;
      const { data, error } = await client
        .from('letters')
        .select('id, subject, body, body_dir, design, recipient_id, updated_at')
        .eq('sender_id', senderId)
        .eq('status', 'draft');
      if (!error && data) {
        const byId = new Map((await localStore.list()).map((d) => [d.id, d] as const));
        for (const row of data as LetterDraftRow[]) {
          if (justPushed.has(row.id)) continue;
          const localMatch = byId.get(row.id);
          if (localMatch?.dirty) continue; // an unpushed local edit wins until it syncs
          if (localMatch && Date.parse(localMatch.updatedAt) >= Date.parse(row.updated_at))
            continue;
          await localStore.upsert(fromRemoteRow(row));
          pulled += 1;
        }
      }

      return { pushed, pulled, failed };
    },
  };
}

let shared: DraftsRepository | null = null;

/** Created on first use, over the real local store, the shared Supabase client, expo-crypto's
 *  UUID generator, and the app's current layout direction. */
export function getDraftsRepository(): DraftsRepository {
  shared ??= createDraftsRepository({
    localStore: nativeDraftsStore,
    client: getSupabase(),
    generateId: randomUUID,
    now: () => new Date().toISOString(),
    fallbackDirection: () => (isLayoutRtl() ? 'rtl' : 'ltr'),
  });
  return shared;
}
