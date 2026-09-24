/**
 * Real `LocalDraftsStore`, over expo-sqlite. Not unit-tested here (see draftsStore.ts); tests use
 * an in-memory fake instead. Verified on a device (not yet done for this file - Phase 3 exit
 * criterion).
 */
import * as SQLite from 'expo-sqlite';

import type { LocalDraft, LocalDraftsStore } from './draftsStore';

const DB_NAME = 'letterapp.db';

let db: SQLite.SQLiteDatabase | null = null;
function database(): SQLite.SQLiteDatabase {
  db ??= SQLite.openDatabaseSync(DB_NAME);
  return db;
}

let schemaReady = false;
function ensureSchema(): void {
  if (schemaReady) return;
  database().execSync(`
    create table if not exists local_drafts (
      id text primary key,
      subject text,
      body text not null default '',
      design text not null default '{}',
      recipient_id text,
      dirty integer not null default 1,
      updated_at text not null
    );
  `);
  schemaReady = true;
}

interface DraftRow {
  id: string;
  subject: string | null;
  body: string;
  design: string;
  recipient_id: string | null;
  dirty: number;
  updated_at: string;
}

function fromRow(row: DraftRow): LocalDraft {
  return {
    id: row.id,
    subject: row.subject,
    body: row.body,
    design: JSON.parse(row.design) as unknown,
    recipientId: row.recipient_id,
    dirty: row.dirty !== 0,
    updatedAt: row.updated_at,
  };
}

export const nativeDraftsStore: LocalDraftsStore = {
  async list() {
    ensureSchema();
    const rows = database().getAllSync<DraftRow>(
      'select * from local_drafts order by updated_at desc',
    );
    return rows.map(fromRow);
  },

  async get(id) {
    ensureSchema();
    const row = database().getFirstSync<DraftRow>('select * from local_drafts where id = ?', id);
    return row ? fromRow(row) : null;
  },

  async upsert(draft) {
    ensureSchema();
    database().runSync(
      `insert into local_drafts (id, subject, body, design, recipient_id, dirty, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set
         subject = excluded.subject,
         body = excluded.body,
         design = excluded.design,
         recipient_id = excluded.recipient_id,
         dirty = excluded.dirty,
         updated_at = excluded.updated_at`,
      draft.id,
      draft.subject,
      draft.body,
      JSON.stringify(draft.design),
      draft.recipientId,
      draft.dirty ? 1 : 0,
      draft.updatedAt,
    );
  },

  async remove(id) {
    ensureSchema();
    database().runSync('delete from local_drafts where id = ?', id);
  },
};
