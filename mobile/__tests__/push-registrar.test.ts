import type { DevicesRepository } from '@/data/notifications/devicesRepository';
import type { PushPlatform } from '@/features/notifications/pushPlatform';
import {
  REREGISTER_AFTER_MS,
  createPushRegistrar,
  type TokenStore,
} from '@/features/notifications/pushRegistrar';

const TOKEN = 'ExponentPushToken[abcdefghij]';

function setup(overrides: Partial<PushPlatform> = {}) {
  const platform: PushPlatform = {
    os: 'android',
    appVersion: '1.0.0',
    ensureChannel: jest.fn(async () => {}),
    requestPermission: jest.fn(async () => true),
    getToken: jest.fn(async () => TOKEN),
    takeLaunchLetterId: () => null,
    onLetterTapped: () => () => {},
    ...overrides,
  };
  const devices: jest.Mocked<DevicesRepository> = {
    register: jest.fn<Promise<void>, Parameters<DevicesRepository['register']>>(async () => {}),
    unregister: jest.fn<Promise<void>, Parameters<DevicesRepository['unregister']>>(async () => {}),
  };
  let stored: string | null = null;
  const store: TokenStore = { get: () => stored, set: (token) => (stored = token) };
  const registrar = createPushRegistrar({
    platform,
    devices,
    store,
    channelName: () => 'Letters',
  });
  return { platform, devices, store, registrar };
}

describe('Push registration (Phase 7)', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('creates the channel, asks permission, registers the token once per user and remembers it', async () => {
    const { platform, devices, store, registrar } = setup();

    await expect(registrar.register('user-a')).resolves.toBe('registered');
    expect(platform.ensureChannel).toHaveBeenCalledWith('Letters');
    expect(devices.register).toHaveBeenCalledWith(TOKEN, 'android', '1.0.0');
    expect(store.get()).toBe(TOKEN);

    // A token refresh re-applies the session: no second call (register_device is rate-limited).
    await expect(registrar.register('user-a')).resolves.toBe('alreadyRegistered');
    expect(devices.register).toHaveBeenCalledTimes(1);

    // Another account on the same device claims the token.
    await expect(registrar.register('user-b')).resolves.toBe('registered');
    expect(devices.register).toHaveBeenCalledTimes(2);
  });

  it('unregisters the remembered token on sign-out, and registers again at the next sign-in', async () => {
    const { devices, store, registrar } = setup();
    await registrar.register('user-a');

    await registrar.unregister();
    expect(devices.unregister).toHaveBeenCalledWith(TOKEN);
    expect(store.get()).toBeNull();

    await expect(registrar.register('user-a')).resolves.toBe('registered');
  });

  it('keeps the token when unregistering fails (offline), and never throws', async () => {
    const { devices, store, registrar } = setup();
    await registrar.register('user-a');
    devices.unregister.mockRejectedValueOnce(new Error('offline'));

    await expect(registrar.unregister()).resolves.toBeUndefined();
    expect(store.get()).toBe(TOKEN);
  });

  it('forget() drops the remembered token without calling the server (account deleted)', async () => {
    const { devices, store, registrar } = setup();
    await registrar.register('user-a');
    registrar.forget();
    expect(store.get()).toBeNull();
    expect(devices.unregister).not.toHaveBeenCalled();
  });

  it('leaves the device unregistered, without throwing, when push is not possible', async () => {
    const denied = setup({ requestPermission: jest.fn(async () => false) });
    await expect(denied.registrar.register('u')).resolves.toBe('denied');

    const unconfigured = setup({ getToken: jest.fn(async () => null) });
    await expect(unconfigured.registrar.register('u')).resolves.toBe('unconfigured');

    const noFirebase = setup({
      getToken: jest.fn(async () => {
        throw new Error('Default FirebaseApp is not initialized');
      }),
    });
    await expect(noFirebase.registrar.register('u')).resolves.toBe('failed');

    const web = setup({ os: 'other' });
    await expect(web.registrar.register('u')).resolves.toBe('unsupported');

    const rateLimited = setup();
    rateLimited.devices.register.mockRejectedValueOnce(new Error('rate_limited'));
    await expect(rateLimited.registrar.register('u')).resolves.toBe('failed');
    expect(rateLimited.store.get()).toBeNull();
    // Not marked as registered: the next launch tries again.
    await expect(rateLimited.registrar.register('u')).resolves.toBe('registered');

    for (const s of [denied, unconfigured, noFirebase, web]) {
      expect(s.devices.register).not.toHaveBeenCalled();
    }
  });
});

describe('Push registration across app runs (phone QA: register_device daily limit)', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  function memoStore() {
    let value: { userId: string; token: string; at: number } | null = null;
    return { get: () => value, set: (next: typeof value) => (value = next) };
  }

  function run(
    memo: ReturnType<typeof memoStore>,
    stored: { token: string | null },
    now: number,
    token = TOKEN,
  ) {
    const devices = {
      register: jest.fn(async () => {}),
      unregister: jest.fn(async () => {}),
    };
    const registrar = createPushRegistrar({
      platform: {
        os: 'android',
        appVersion: '1.0.0',
        ensureChannel: async () => {},
        requestPermission: async () => true,
        getToken: async () => token,
        takeLaunchLetterId: () => null,
        onLetterTapped: () => () => {},
      },
      devices,
      store: { get: () => stored.token, set: (t) => (stored.token = t) },
      channelName: () => 'Letters',
      memo,
      now: () => now,
    });
    return { registrar, devices };
  }

  it('does not re-send an unchanged token for the same user on the next cold start', async () => {
    const memo = memoStore();
    const stored = { token: null as string | null };
    const first = run(memo, stored, 1_000);
    await expect(first.registrar.register('user-a')).resolves.toBe('registered');

    const second = run(memo, stored, 1_000 + 60_000); // a new app run a minute later
    await expect(second.registrar.register('user-a')).resolves.toBe('alreadyRegistered');
    expect(second.devices.register).not.toHaveBeenCalled();
  });

  it('re-sends after a day, for a rotated token, and for another user', async () => {
    const memo = memoStore();
    const stored = { token: null as string | null };
    await run(memo, stored, 0).registrar.register('user-a');

    const later = run(memo, stored, REREGISTER_AFTER_MS + 1);
    await expect(later.registrar.register('user-a')).resolves.toBe('registered');

    const rotated = run(memo, stored, REREGISTER_AFTER_MS + 2, 'ExponentPushToken[rotated]');
    await expect(rotated.registrar.register('user-a')).resolves.toBe('registered');

    const other = run(memo, stored, REREGISTER_AFTER_MS + 3, 'ExponentPushToken[rotated]');
    await expect(other.registrar.register('user-b')).resolves.toBe('registered');
  });
});
