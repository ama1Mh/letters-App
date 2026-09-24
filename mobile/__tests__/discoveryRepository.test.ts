import type { SupabaseClient } from '@supabase/supabase-js';

import {
  DiscoveryActionError,
  createDiscoveryRepository,
} from '@/data/discovery/discoveryRepository';

function fakeClient(
  overrides: {
    rpcResults?: Record<string, { data?: unknown; error?: unknown }>;
    session?: { user: { id: string } } | null;
    connectionsRows?: unknown[];
  } = {},
) {
  const session = 'session' in overrides ? overrides.session : { user: { id: 'me' } };
  return {
    auth: {
      getSession: async () => ({ data: { session } }),
    },
    rpc: (name: string) =>
      Promise.resolve(overrides.rpcResults?.[name] ?? { data: null, error: null }),
    from: () => ({
      select: () => ({
        eq: async () => ({ data: overrides.connectionsRows ?? [], error: null }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('createDiscoveryRepository', () => {
  it('maps search_users rows from snake_case to camelCase', async () => {
    const repo = createDiscoveryRepository(
      fakeClient({
        rpcResults: {
          search_users: {
            data: [
              {
                id: 'u1',
                username: 'sara',
                display_name: 'Sara',
                avatar_key: null,
                receive_mode: 'everyone',
                connection_state: 'none',
              },
            ],
          },
        },
      }),
    );
    await expect(repo.searchUsers('sar')).resolves.toEqual([
      {
        id: 'u1',
        username: 'sara',
        displayName: 'Sara',
        avatarKey: null,
        receiveMode: 'everyone',
        connectionState: 'none',
      },
    ]);
  });

  it('maps a known RPC error message to a code', async () => {
    const repo = createDiscoveryRepository(
      fakeClient({ rpcResults: { search_users: { error: { message: 'query_too_short' } } } }),
    );
    await expect(repo.searchUsers('a')).rejects.toEqual(
      new DiscoveryActionError('query_too_short'),
    );
  });

  it('falls back to "unknown" for an unrecognized error message', async () => {
    const repo = createDiscoveryRepository(
      fakeClient({ rpcResults: { request_connection: { error: { message: 'boom' } } } }),
    );
    await expect(repo.requestConnection('u2')).rejects.toEqual(new DiscoveryActionError('unknown'));
  });

  it('findUserByEmail returns null for an empty result set, not an error', async () => {
    const repo = createDiscoveryRepository(
      fakeClient({ rpcResults: { find_user_by_email: { data: [] } } }),
    );
    await expect(repo.findUserByEmail('nobody@example.test')).resolves.toBeNull();
  });

  it('requestConnection/redeemInvite resolve with the returned id', async () => {
    const repo = createDiscoveryRepository(
      fakeClient({
        rpcResults: { request_connection: { data: 'conn-1' }, redeem_invite: { data: 'conn-2' } },
      }),
    );
    await expect(repo.requestConnection('u2')).resolves.toBe('conn-1');
    await expect(repo.redeemInvite('CODE')).resolves.toBe('conn-2');
  });

  it('getOrCreateInvite maps the invite row', async () => {
    const repo = createDiscoveryRepository(
      fakeClient({
        rpcResults: {
          get_or_create_invite: {
            data: { id: 'inv-1', code: 'ABCDEFGHIJ', revoked_at: null, expires_at: null },
          },
        },
      }),
    );
    await expect(repo.getOrCreateInvite()).resolves.toEqual({
      id: 'inv-1',
      code: 'ABCDEFGHIJ',
      revokedAt: null,
      expiresAt: null,
    });
  });

  it('listPendingConnections splits rows into incoming and outgoing by the caller', async () => {
    const repo = createDiscoveryRepository(
      fakeClient({
        session: { user: { id: 'me' } },
        connectionsRows: [
          {
            id: 'c1',
            requester_id: 'me',
            addressee_id: 'other1',
            created_at: 't1',
            requester: null,
            addressee: { username: 'other1_username', display_name: 'Other One' },
          },
          {
            id: 'c2',
            requester_id: 'other2',
            addressee_id: 'me',
            created_at: 't2',
            requester: { username: 'other2_username', display_name: 'Other Two' },
            addressee: null,
          },
        ],
      }),
    );
    await expect(repo.listPendingConnections()).resolves.toEqual({
      outgoing: [
        {
          id: 'c1',
          otherUserId: 'other1',
          otherUsername: 'other1_username',
          otherDisplayName: 'Other One',
          createdAt: 't1',
        },
      ],
      incoming: [
        {
          id: 'c2',
          otherUserId: 'other2',
          otherUsername: 'other2_username',
          otherDisplayName: 'Other Two',
          createdAt: 't2',
        },
      ],
    });
  });

  it('listPendingConnections throws not_authenticated without a session', async () => {
    const repo = createDiscoveryRepository(fakeClient({ session: null }));
    await expect(repo.listPendingConnections()).rejects.toEqual(
      new DiscoveryActionError('not_authenticated'),
    );
  });
});
