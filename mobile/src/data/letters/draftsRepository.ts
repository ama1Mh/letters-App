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
          const { error } = await client
            .from('letters')
            .upsert(toRemoteRow(draft, senderId), { onConflict: 'id' });
          if (error) throw error;
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
