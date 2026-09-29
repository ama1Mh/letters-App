import {
  DiscoveryActionError,
  type BlockedUser,
  type ConnectionRow,
  type DiscoveryErrorCode,
  type DiscoveryRepository,
  type Invite,
  type SearchResult,
} from '@/data/discovery/discoveryRepository';

/** In-memory DiscoveryRepository for tests, mirroring fakeAuthRepository.ts's style. */
export function createFakeDiscoveryRepository(
  options: {
    searchResults?: SearchResult[];
    emailResult?: SearchResult | null;
    invite?: Invite;
    pending?: { incoming: ConnectionRow[]; outgoing: ConnectionRow[] };
    fail?: Partial<Record<keyof DiscoveryRepository, DiscoveryErrorCode>>;
    blocked?: BlockedUser[];
  } = {},
): DiscoveryRepository {
  function maybeThrow(method: keyof DiscoveryRepository) {
    const code = options.fail?.[method];
    if (code) throw new DiscoveryActionError(code);
  }

  let invite: Invite = options.invite ?? {
    id: 'invite-1',
    code: 'AAAAAAAAAA',
    revokedAt: null,
    expiresAt: null,
  };
  const pending = options.pending ?? { incoming: [], outgoing: [] };
  let blocked = [...(options.blocked ?? [])];

  return {
    async searchUsers(_query) {
      maybeThrow('searchUsers');
      return options.searchResults ?? [];
    },
    async findUserByEmail(_email) {
      maybeThrow('findUserByEmail');
      return options.emailResult ?? null;
    },
    async requestConnection(_addresseeId) {
      maybeThrow('requestConnection');
      return 'connection-1';
    },
    async acceptConnection(_connectionId) {
      maybeThrow('acceptConnection');
    },
    async declineConnection(_connectionId) {
      maybeThrow('declineConnection');
    },
    async cancelConnectionRequest(_connectionId) {
      maybeThrow('cancelConnectionRequest');
    },
    async removeConnection(_connectionId) {
      maybeThrow('removeConnection');
    },
    async listPendingConnections() {
      maybeThrow('listPendingConnections');
      return pending;
    },
    async blockUser(_userId) {
      maybeThrow('blockUser');
    },
    async unblockUser(userId) {
      maybeThrow('unblockUser');
      blocked = blocked.filter((item) => item.userId !== userId);
    },
    async listBlockedUsers() {
      maybeThrow('listBlockedUsers');
      return blocked;
    },

    async getOrCreateInvite() {
      maybeThrow('getOrCreateInvite');
      return invite;
    },
    async regenerateInvite() {
      maybeThrow('regenerateInvite');
      invite = { ...invite, code: `${invite.code}X` };
      return invite;
    },
    async redeemInvite(_code) {
      maybeThrow('redeemInvite');
      return 'connection-redeemed';
    },
  };
}
