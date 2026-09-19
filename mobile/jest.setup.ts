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

export {};
