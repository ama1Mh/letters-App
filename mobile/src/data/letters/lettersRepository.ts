/**
 * Sending, scheduling, reading and the letter lists (Phase 6, DEC-044/046/048). Wraps the RPCs from
 * supabase/migrations/20260925150000_letters_sending.sql, 20260925160000_delivery.sql,
 * 20260927090000_letter_lists.sql and 20260927100000_send_min_lead_time.sql behind one narrow
 * interface, the same injected-client pattern as discoveryRepository.ts. Errors are codes: our own
 * RPCs raise the documented codes as the exception message.
 *
 * Drafts are NOT read through here: they stay local-first in draftsRepository.ts, and the list RPCs
 * never return drafts (DEC-046 (4)).
 *
 * Row types come from the generated `database.types.ts` (`npm run gen:types`), so a renamed column
 * or enum value fails the build. `supabase gen types` marks every column of a function's result as
 * non-null (Postgres records no nullability for function results), so each row type re-marks the
 * columns the SQL can really return as null (DEC-048 (D3)).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeDesign, type Design } from '@/domain/design';

import { getSupabase } from '../supabase';
import type { Database } from '../supabase/database.types';

type PublicSchema = Database['public'];

export type LetterStatus = PublicSchema['Enums']['letter_status'];
export type TextDir = PublicSchema['Enums']['text_dir'];

export type LetterErrorCode =
  | 'not_authenticated'
  | 'invalid_input'
  | 'not_found'
  | 'recipient_required'
  | 'body_empty'
  | 'cannot_send'
  | 'schedule_in_past'
  | 'schedule_too_soon'
  | 'schedule_too_far'
  | 'rate_limited'
  | 'already_delivered'
  | 'not_scheduled'
  | 'unknown';

export class LetterActionError extends Error {
  readonly code: LetterErrorCode;
  constructor(code: LetterErrorCode) {
    super(`letter action failed: ${code}`);
    this.name = 'LetterActionError';
    this.code = code;
  }
}

/** The other person on a letter. Username/display name/avatar are null for a deleted account. */
export interface Correspondent {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarKey: string | null;
}

export interface SendState {
  status: LetterStatus;
  scheduledAt: string | null;
  deliveredAt: string | null;
}

/** Keyset position: the last row's `(sortAt, id)`. */
export interface ListCursor {
  at: string;
  id: string;
}

export interface Page<T> {
  items: T[];
  /** Null when this page was not full, i.e. there is nothing more to load. */
  nextCursor: ListCursor | null;
}

export interface InboxItem {
  id: string;
  threadId: string;
  subject: string | null;
  /** At most 200 characters, whitespace collapsed (server-side). */
  preview: string;
  bodyDir: TextDir;
  deliveredAt: string;
  readAt: string | null;
  sortAt: string;
  sender: Correspondent;
}

export type SentKind = 'scheduled' | 'sent';

export interface SentItem {
  id: string;
  threadId: string;
  subject: string | null;
  preview: string;
  bodyDir: TextDir;
  status: LetterStatus;
  scheduledAt: string | null;
  deliveredAt: string | null;
  /** Masked by the server unless the recipient shares read receipts (DEC-044 (2)). */
  readAt: string | null;
  sortAt: string;
  recipient: Correspondent;
}

export interface Letter {
  id: string;
  threadId: string;
  parentLetterId: string | null;
  subject: string | null;
  body: string;
  bodyDir: TextDir;
  design: Design;
  status: LetterStatus;
  scheduledAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  /** `recipient` also for a delivered letter to yourself. */
  viewerRole: 'sender' | 'recipient';
  sender: Correspondent;
  recipient: Correspondent;
}

export const DEFAULT_PAGE_SIZE = 30;
/** The list RPCs clamp `p_limit` to 1..100; clamping here too keeps `nextCursor` honest. */
export const MAX_PAGE_SIZE = 100;

function clampLimit(limit: number): number {
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE);
}

export interface LettersRepository {
  /** `scheduledAt` omitted or null = send now. Idempotent for a letter that already left draft. */
  sendLetter(letterId: string, scheduledAt?: Date | null): Promise<SendState>;
  /** A scheduled letter goes back to draft. */
  unscheduleLetter(letterId: string): Promise<SendState>;
  /** Resolves with the stored read time (unchanged if it was already read). */
  markRead(letterId: string): Promise<string>;
  listInbox(cursor?: ListCursor | null, limit?: number): Promise<Page<InboxItem>>;
  listSent(kind: SentKind, cursor?: ListCursor | null, limit?: number): Promise<Page<SentItem>>;
  /** Rejects with `not_found` for every letter the caller may not see. */
  getLetter(letterId: string): Promise<Letter>;
}

const KNOWN_CODES: readonly LetterErrorCode[] = [
  'not_authenticated',
  'invalid_input',
  'not_found',
  'recipient_required',
  'body_empty',
  'cannot_send',
  'schedule_in_past',
  'schedule_too_soon',
  'schedule_too_far',
  'rate_limited',
  'already_delivered',
  'not_scheduled',
];

function stringProp(value: object, key: string): string | undefined {
  if (!(key in value)) return undefined;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === 'string' ? raw : undefined;
}

function toLetterError(error: unknown): LetterActionError {
  const message =
    error !== null && typeof error === 'object' ? stringProp(error, 'message') : undefined;
  const code =
    message !== undefined && (KNOWN_CODES as readonly string[]).includes(message)
      ? (message as LetterErrorCode)
      : 'unknown';
  return new LetterActionError(code);
}

/** One row of a set-returning RPC, as generated. */
type RpcRow<Name extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][Name]['Returns'] extends (infer Row)[] ? Row : never;

/** Re-marks generated (always non-null) columns that the SQL can return as null. */
type WithNullable<Row, Keys extends keyof Row> = Omit<Row, Keys> & { [K in Keys]: Row[K] | null };

type SendStateComposite = PublicSchema['CompositeTypes']['letter_send_state'];
/** Composite fields are all generated as nullable; send/unschedule always set `status`. */
type SendStateRow = Omit<SendStateComposite, 'status'> & {
  status: NonNullable<SendStateComposite['status']>;
};

/** Nullable: subject; read_at (unread); the sender's profile fields (deleted account). */
type InboxRow = WithNullable<
  RpcRow<'list_inbox'>,
  'subject' | 'read_at' | 'sender_username' | 'sender_display_name' | 'sender_avatar_key'
>;

/** Nullable: subject; scheduled_at/delivered_at (by status); read_at (masked); the recipient's profile. */
type SentRow = WithNullable<
  RpcRow<'list_sent'>,
  | 'subject'
  | 'scheduled_at'
  | 'delivered_at'
  | 'read_at'
  | 'recipient_username'
  | 'recipient_display_name'
  | 'recipient_avatar_key'
>;

/** Nullable: parent (not a reply), subject, the status-dependent times and both profiles; the
 *  generated `viewer_role: string` is narrowed to the two values the SQL returns. */
type LetterRow = Omit<
  WithNullable<
    RpcRow<'get_letter'>,
    | 'parent_letter_id'
    | 'subject'
    | 'scheduled_at'
    | 'delivered_at'
    | 'read_at'
    | 'sender_username'
    | 'sender_display_name'
    | 'sender_avatar_key'
    | 'recipient_username'
    | 'recipient_display_name'
    | 'recipient_avatar_key'
  >,
  'viewer_role'
> & { viewer_role: 'sender' | 'recipient' };

function mapSendState(row: SendStateRow): SendState {
  return { status: row.status, scheduledAt: row.scheduled_at, deliveredAt: row.delivered_at };
}

function mapInboxRow(row: InboxRow): InboxItem {
  return {
    id: row.id,
    threadId: row.thread_id,
    subject: row.subject,
    preview: row.preview,
    bodyDir: row.body_dir,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    sortAt: row.sort_at,
    sender: {
      id: row.sender_id,
      username: row.sender_username,
      displayName: row.sender_display_name,
      avatarKey: row.sender_avatar_key,
    },
  };
}

function mapSentRow(row: SentRow): SentItem {
  return {
    id: row.id,
    threadId: row.thread_id,
    subject: row.subject,
    preview: row.preview,
    bodyDir: row.body_dir,
    status: row.status,
    scheduledAt: row.scheduled_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    sortAt: row.sort_at,
    recipient: {
      id: row.recipient_id,
      username: row.recipient_username,
      displayName: row.recipient_display_name,
      avatarKey: row.recipient_avatar_key,
    },
  };
}

function mapLetterRow(row: LetterRow): Letter {
  return {
    id: row.id,
    threadId: row.thread_id,
    parentLetterId: row.parent_letter_id,
    subject: row.subject,
    body: row.body,
    bodyDir: row.body_dir,
    design: normalizeDesign(row.design),
    status: row.status,
    scheduledAt: row.scheduled_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    viewerRole: row.viewer_role,
    sender: {
      id: row.sender_id,
      username: row.sender_username,
      displayName: row.sender_display_name,
      avatarKey: row.sender_avatar_key,
    },
    recipient: {
      id: row.recipient_id,
      username: row.recipient_username,
      displayName: row.recipient_display_name,
      avatarKey: row.recipient_avatar_key,
    },
  };
}

function toPage<T extends { id: string; sortAt: string }>(items: T[], limit: number): Page<T> {
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: items.length >= limit && last ? { at: last.sortAt, id: last.id } : null,
  };
}

/** Pure of native modules: the client is injected. */
export function createLettersRepository(client: SupabaseClient): LettersRepository {
  return {
    async sendLetter(letterId, scheduledAt) {
      const { data, error } = await client.rpc('send_letter', {
        p_letter_id: letterId,
        p_scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
      });
      if (error) throw toLetterError(error);
      return mapSendState(data as SendStateRow);
    },

    async unscheduleLetter(letterId) {
      const { data, error } = await client.rpc('unschedule_letter', { p_letter_id: letterId });
      if (error) throw toLetterError(error);
      return mapSendState(data as SendStateRow);
    },

    async markRead(letterId) {
      const { data, error } = await client.rpc('mark_read', { p_letter_id: letterId });
      if (error) throw toLetterError(error);
      return data as string;
    },

    async listInbox(cursor, limit = DEFAULT_PAGE_SIZE) {
      const size = clampLimit(limit);
      const { data, error } = await client.rpc('list_inbox', {
        p_cursor_at: cursor?.at ?? null,
        p_cursor_id: cursor?.id ?? null,
        p_limit: size,
      });
      if (error) throw toLetterError(error);
      return toPage(((data ?? []) as InboxRow[]).map(mapInboxRow), size);
    },

    async listSent(kind, cursor, limit = DEFAULT_PAGE_SIZE) {
      const size = clampLimit(limit);
      const { data, error } = await client.rpc('list_sent', {
        p_kind: kind,
        p_cursor_at: cursor?.at ?? null,
        p_cursor_id: cursor?.id ?? null,
        p_limit: size,
      });
      if (error) throw toLetterError(error);
      return toPage(((data ?? []) as SentRow[]).map(mapSentRow), size);
    },

    async getLetter(letterId) {
      const { data, error } = await client.rpc('get_letter', { p_letter_id: letterId });
      if (error) throw toLetterError(error);
      const rows = (data ?? []) as LetterRow[];
      if (rows.length === 0) throw new LetterActionError('not_found');
      return mapLetterRow(rows[0]);
    },
  };
}

let shared: LettersRepository | null = null;

export function getLettersRepository(): LettersRepository {
  shared ??= createLettersRepository(getSupabase());
  return shared;
}
