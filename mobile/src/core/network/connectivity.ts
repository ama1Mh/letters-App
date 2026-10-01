/**
 * Connectivity (Phase 10 offline states). The only module that imports NetInfo. "Offline" means
 * Android reports no connection, or a connection it could not validate (captive portal, no
 * route); while NetInfo is still unsure (`isInternetReachable === null`) we assume online, so the
 * banner never flashes at startup.
 */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function isOnlineState(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>,
): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/** Calls `listener` with the current state and on every online/offline change (deduplicated). */
export function subscribeOnline(listener: (online: boolean) => void): () => void {
  let last: boolean | null = null;
  return NetInfo.addEventListener((state) => {
    const online = isOnlineState(state);
    if (online === last) return;
    last = online;
    listener(online);
  });
}

/** Calls `listener` each time the device comes back online after having been offline. */
export function subscribeReconnect(listener: () => void): () => void {
  let wasOffline = false;
  return subscribeOnline((online) => {
    if (online && wasOffline) listener();
    wasOffline = !online;
  });
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => subscribeOnline(setOnline), []);
  return online;
}
