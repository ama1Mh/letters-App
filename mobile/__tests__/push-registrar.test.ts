import type { DevicesRepository } from '@/data/notifications/devicesRepository';
import type { PushPlatform } from '@/features/notifications/pushPlatform';
import { createPushRegistrar, type TokenStore } from '@/features/notifications/pushRegistrar';

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
