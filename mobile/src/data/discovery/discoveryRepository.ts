/**
 * Discovery, connections, invites and blocks (Phase 5). Wraps the RPCs from
 * supabase/migrations/20260925*.sql behind one narrow interface, the same injected-client pattern
 * as auth.ts's AuthRepository. Errors are codes: our own RPCs raise the codes documented in those
 * migrations as the exception message; there is no separate `.code` field on a Postgrest RPC error
 * (same reasoning as auth.ts's AuthActionError).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabase } from '../supabase';

export type ConnectionState = 'none' | 'pending_out' | 'pending_in' | 'connected';

export interface SearchResult {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarKey: string | null;
  receiveMode: 'everyone' | 'invite_only';
  connectionState: ConnectionState;
}

export interface Invite {
  id: string;
  code: string;
  revokedAt: string | null;
  expiresAt: string | null;
}

export type DiscoveryErrorCode =
  | 'not_authenticated'
  | 'invalid_input'
  | 'profile_not_found'
  | 'query_too_short'
  | 'rate_limited'
  | 'not_found'
  | 'not_pending'
  | 'not_connected'
  | 'already_connected'
  | 'already_pending'
  | 'recently_declined'
  | 'too_many_pending'
  | 'invite_not_found'
  | 'invite_code_generation_failed'
  | 'unknown';

export class DiscoveryActionError extends Error {
  readonly code: DiscoveryErrorCode;
  constructor(code: DiscoveryErrorCode) {
    super(`discovery action failed: ${code}`);
    this.name = 'DiscoveryActionError';
    this.code = code;
  }
}

export interface DiscoveryRepository {
  searchUsers(query: string): Promise<SearchResult[]>;
  findUserByEmail(email: string): Promise<SearchResult | null>;

  requestConnection(addresseeId: string): Promise<string>;
  acceptConnection(connectionId: string): Promise<void>;
  declineConnection(connectionId: string): Promise<void>;
  cancelConnectionRequest(connectionId: string): Promise<void>;
  removeConnection(connectionId: string): Promise<void>;
  /** Incoming (addressed to me) and outgoing (sent by me) pending requests. */
  listPendingConnections(): Promise<{ incoming: ConnectionRow[]; outgoing: ConnectionRow[] }>;

  blockUser(userId: string): Promise<void>;
  unblockUser(userId: string): Promise<void>;

  getOrCreateInvite(): Promise<Invite>;
  regenerateInvite(): Promise<Invite>;
  /** Resolves with the resulting connection id. */
  redeemInvite(code: string): Promise<string>;
}

export interface ConnectionRow {
  id: string;
  otherUserId: string;
  otherUsername: string | null;
  otherDisplayName: string | null;
  createdAt: string;
}

const KNOWN_CODES: readonly DiscoveryErrorCode[] = [
  'not_authenticated',
  'invalid_input',
  'profile_not_found',
  'query_too_short',
  'rate_limited',
  'not_found',
  'not_pending',
  'not_connected',
  'already_connected',
  'already_pending',
  'recently_declined',
  'too_many_pending',
  'invite_not_found',
  'invite_code_generation_failed',
];

function stringProp(value: object, key: string): string | undefined {
  if (!(key in value)) return undefined;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === 'string' ? raw : undefined;
}

function toDiscoveryError(error: unknown): DiscoveryActionError {
  const message =
    error !== null && typeof error === 'object' ? stringProp(error, 'message') : undefined;
  const code =
    message !== undefined && (KNOWN_CODES as readonly string[]).includes(message)
      ? (message as DiscoveryErrorCode)
      : 'unknown';
  return new DiscoveryActionError(code);
}

interface SearchRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_key: string | null;
  receive_mode: 'everyone' | 'invite_only';
  connection_state: ConnectionState;
}

function mapSearchRow(row: SearchRow): SearchResult {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarKey: row.avatar_key,
    receiveMode: row.receive_mode,
    connectionState: row.connection_state,
  };
}

interface InviteRow {
  id: string;
  code: string;
  revoked_at: string | null;
  expires_at: string | null;
}

function mapInviteRow(row: InviteRow): Invite {
  return { id: row.id, code: row.code, revokedAt: row.revoked_at, expiresAt: row.expires_at };
}

/** Pure of native modules: the client is injected. */
export function createDiscoveryRepository(client: SupabaseClient): DiscoveryRepository {
  return {
    async searchUsers(query) {
      const { data, error } = await client.rpc('search_users', { p_query: query });
      if (error) throw toDiscoveryError(error);
      return ((data ?? []) as SearchRow[]).map(mapSearchRow);
    },

    async findUserByEmail(email) {
      const { data, error } = await client.rpc('find_user_by_email', { p_email: email });
      if (error) throw toDiscoveryError(error);
      const rows = (data ?? []) as SearchRow[];
      return rows.length > 0 ? mapSearchRow(rows[0]) : null;
    },

    async requestConnection(addresseeId) {
      const { data, error } = await client.rpc('request_connection', {
        p_addressee_id: addresseeId,
      });
      if (error) throw toDiscoveryError(error);
      return data as string;
    },

    async acceptConnection(connectionId) {
      const { error } = await client.rpc('accept_connection', { p_connection_id: connectionId });
      if (error) throw toDiscoveryError(error);
    },

    async declineConnection(connectionId) {
      const { error } = await client.rpc('decline_connection', { p_connection_id: connectionId });
      if (error) throw toDiscoveryError(error);
    },

    async cancelConnectionRequest(connectionId) {
      const { error } = await client.rpc('cancel_connection_request', {
        p_connection_id: connectionId,
      });
      if (error) throw toDiscoveryError(error);
    },

    async removeConnection(connectionId) {
      const { error } = await client.rpc('remove_connection', { p_connection_id: connectionId });
      if (error) throw toDiscoveryError(error);
    },

    async listPendingConnections() {
      const {
        data: { session },
      } = await client.auth.getSession();
      const uid = session?.user.id;
      if (!uid) throw new DiscoveryActionError('not_authenticated');

      const { data, error } = await client
        .from('connections')
        .select(
          'id, requester_id, addressee_id, created_at, requester:profiles!connections_requester_id_fkey(username, display_name), addressee:profiles!connections_addressee_id_fkey(username, display_name)',
        )
        .eq('status', 'pending');
      if (error) throw toDiscoveryError(error);

      const incoming: ConnectionRow[] = [];
      const outgoing: ConnectionRow[] = [];
      for (const row of (data ?? []) as unknown as {
        id: string;
        requester_id: string;
        addressee_id: string;
        created_at: string;
        requester: { username: string | null; display_name: string | null } | null;
        addressee: { username: string | null; display_name: string | null } | null;
      }[]) {
        if (row.addressee_id === uid) {
          incoming.push({
            id: row.id,
            otherUserId: row.requester_id,
            otherUsername: row.requester?.username ?? null,
            otherDisplayName: row.requester?.display_name ?? null,
            createdAt: row.created_at,
          });
        } else if (row.requester_id === uid) {
          outgoing.push({
            id: row.id,
            otherUserId: row.addressee_id,
            otherUsername: row.addressee?.username ?? null,
            otherDisplayName: row.addressee?.display_name ?? null,
            createdAt: row.created_at,
          });
        }
      }
      return { incoming, outgoing };
    },

    async blockUser(userId) {
      const { error } = await client.rpc('block_user', { p_blocked_id: userId });
      if (error) throw toDiscoveryError(error);
    },

    async unblockUser(userId) {
      const { error } = await client.rpc('unblock_user', { p_blocked_id: userId });
      if (error) throw toDiscoveryError(error);
    },

    async getOrCreateInvite() {
      const { data, error } = await client.rpc('get_or_create_invite');
      if (error) throw toDiscoveryError(error);
      return mapInviteRow(data as InviteRow);
    },

    async regenerateInvite() {
      const { data, error } = await client.rpc('regenerate_invite');
      if (error) throw toDiscoveryError(error);
      return mapInviteRow(data as InviteRow);
    },

    async redeemInvite(code) {
      const { data, error } = await client.rpc('redeem_invite', { p_code: code });
      if (error) throw toDiscoveryError(error);
      return data as string;
    },
  };
}

let shared: DiscoveryRepository | null = null;

export function getDiscoveryRepository(): DiscoveryRepository {
  shared ??= createDiscoveryRepository(getSupabase());
  return shared;
}
