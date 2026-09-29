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
      body_dir text not null default 'ltr',
      design text not null default '{}',
      recipient_id text,
      dirty integer not null default 1,
      updated_at text not null
    );
  `);
  // Phase 8 added replies: existing installs get the column (sqlite has no "add column if not
  // exists").
  const columns = database().getAllSync<{ name: string }>('pragma table_info(local_drafts)');
  if (!columns.some((column) => column.name === 'parent_letter_id')) {
    database().execSync('alter table local_drafts add column parent_letter_id text');
  }
  schemaReady = true;
}

interface DraftRow {
  id: string;
  subject: string | null;
  body: string;
  body_dir: string;
  design: string;
  recipient_id: string | null;
  parent_letter_id: string | null;
  dirty: number;
  updated_at: string;
}

function fromRow(row: DraftRow): LocalDraft {
  return {
    id: row.id,
    subject: row.subject,
    body: row.body,
    bodyDir: row.body_dir === 'rtl' ? 'rtl' : 'ltr',
    design: JSON.parse(row.design) as unknown,
    recipientId: row.recipient_id,
    parentLetterId: row.parent_letter_id,
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
      `insert into local_drafts
         (id, subject, body, body_dir, design, recipient_id, parent_letter_id, dirty, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set
         subject = excluded.subject,
         body = excluded.body,
         body_dir = excluded.body_dir,
         design = excluded.design,
         recipient_id = excluded.recipient_id,
         parent_letter_id = excluded.parent_letter_id,
         dirty = excluded.dirty,
         updated_at = excluded.updated_at`,
      draft.id,
      draft.subject,
      draft.body,
      draft.bodyDir,
      JSON.stringify(draft.design),
      draft.recipientId,
      draft.parentLetterId ?? null,
      draft.dirty ? 1 : 0,
      draft.updatedAt,
    );
  },

  async remove(id) {
    ensureSchema();
    database().runSync('delete from local_drafts where id = ?', id);
  },

  async clear() {
    ensureSchema();
    database().runSync('delete from local_drafts');
  },
};
