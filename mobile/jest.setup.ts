// In-memory stand-ins for native modules that do not exist under Jest.

// The kv-store lives on globalThis so it survives `jest.resetModules()` / `isolateModules`,
// like real on-disk storage survives an app restart.
declare global {
  // eslint-disable-next-line no-var -- `declare global` requires var
  var __kvStore: Map<string, string> | undefined;
}

jest.mock('expo-sqlite/kv-store', () => {
  const store = (globalThis.__kvStore ??= new Map<string, string>());
  return {
    __esModule: true,
    default: {
      getItemSync: (key: string) => store.get(key) ?? null,
      setItemSync: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItemSync: (key: string) => {
        store.delete(key);
      },
      clearSync: () => store.clear(),
    },
  };
});

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));

// NetInfo: online by default; tests flip it with `global.__setNetInfo({ isConnected: false })`.
declare global {
  // eslint-disable-next-line no-var -- `declare global` requires var
  var __setNetInfo: (state: { isConnected: boolean; isInternetReachable?: boolean | null }) => void;
}

jest.mock('@react-native-community/netinfo', () => {
  type MockState = { isConnected: boolean; isInternetReachable: boolean | null };
  type MockListener = (mockState: MockState) => void;
  const mockListeners = new Set<MockListener>();
  let mockCurrent: MockState = { isConnected: true, isInternetReachable: true };
  globalThis.__setNetInfo = (mockNext) => {
    mockCurrent = { isInternetReachable: mockNext.isConnected, ...mockNext };
    for (const mockListener of [...mockListeners]) mockListener(mockCurrent);
  };
  return {
    __esModule: true,
    default: {
      addEventListener: (mockListener: MockListener) => {
        mockListeners.add(mockListener);
        mockListener(mockCurrent);
        return () => mockListeners.delete(mockListener);
      },
      fetch: async () => mockCurrent,
    },
  };
});

export {};
