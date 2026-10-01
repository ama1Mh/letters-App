import { isOnlineState, subscribeReconnect } from '@/core/network/connectivity';

describe('connectivity', () => {
  afterEach(() => globalThis.__setNetInfo({ isConnected: true }));

  it('treats an unknown reachability as online, and a known failure as offline', () => {
    expect(isOnlineState({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(isOnlineState({ isConnected: true, isInternetReachable: false })).toBe(false);
    expect(isOnlineState({ isConnected: false, isInternetReachable: null })).toBe(false);
    expect(isOnlineState({ isConnected: null, isInternetReachable: null })).toBe(true);
  });

  it('fires on reconnect only, not at subscribe time or on repeated online states', () => {
    const listener = jest.fn();
    const stop = subscribeReconnect(listener);
    expect(listener).not.toHaveBeenCalled();
    globalThis.__setNetInfo({ isConnected: true });
    expect(listener).not.toHaveBeenCalled();
    globalThis.__setNetInfo({ isConnected: false });
    globalThis.__setNetInfo({ isConnected: false });
    globalThis.__setNetInfo({ isConnected: true });
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    globalThis.__setNetInfo({ isConnected: false });
    globalThis.__setNetInfo({ isConnected: true });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
