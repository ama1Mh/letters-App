/**
 * Registers this device for delivery notifications (Phase 7, DEC-050). Push is only a hint (the
 * inbox is the source of truth, PLAN §5), so nothing here ever throws to the caller: every step
 * that can fail (no permission, no FCM/EAS configuration yet, offline, rate limit) just leaves the
 * device unregistered and reports why.
 *
 * - `register(userId)` runs when a user reaches `ready`. It registers at most once per user per app
 *   run: `AuthProvider` re-applies the session on every token refresh, and `register_device` is
 *   rate-limited (30 a day).
 * - `unregister()` runs before sign-out, while the session can still call `unregister_device`.
 *   If it fails (offline), the next sign-in on this device moves the token to the new user
 *   (`register_device` claims it), so pushes never keep following the old account once someone
 *   else signs in.
 * - `forget()` runs after account deletion: the server already removed the device rows.
 */
import Storage from 'expo-sqlite/kv-store';

import { i18n } from '../../core/i18n';
import {
  getDevicesRepository,
  type DevicesRepository,
} from '../../data/notifications/devicesRepository';
import { getPushPlatform, type PushPlatform } from './pushPlatform';

export type RegisterOutcome =
  'registered' | 'alreadyRegistered' | 'unsupported' | 'denied' | 'unconfigured' | 'failed';

export interface PushRegistrar {
  register(userId: string): Promise<RegisterOutcome>;
  unregister(): Promise<void>;
  forget(): void;
}

/** Where the last registered token is remembered, so sign-out can unregister exactly that one. */
export interface TokenStore {
  get(): string | null;
  set(token: string | null): void;
}

const TOKEN_KEY = 'push.registeredToken';

export const kvTokenStore: TokenStore = {
  get() {
    try {
      return Storage.getItemSync(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      if (token === null) Storage.removeItemSync(TOKEN_KEY);
      else Storage.setItemSync(TOKEN_KEY, token);
    } catch {
      // Best effort: at worst sign-out cannot unregister, and the next sign-in claims the token.
    }
  },
};

export interface PushRegistrarDeps {
  platform: PushPlatform;
  devices: DevicesRepository;
  store: TokenStore;
  /** The Android channel's name as shown in system settings, in the current UI language. */
  channelName: () => string;
}

export function createPushRegistrar({
  platform,
  devices,
  store,
  channelName,
}: PushRegistrarDeps): PushRegistrar {
  let registeredFor: string | null = null;

  return {
    async register(userId) {
      if (registeredFor === userId) return 'alreadyRegistered';
      if (platform.os === 'other') return 'unsupported';
      try {
        await platform.ensureChannel(channelName());
        if (!(await platform.requestPermission())) return 'denied';
        const token = await platform.getToken();
        if (!token) return 'unconfigured';
        await devices.register(token, platform.os, platform.appVersion);
        store.set(token);
        registeredFor = userId;
        return 'registered';
      } catch (error) {
        // Never the token: only which step failed.
        console.warn(`Push registration skipped (${(error as Error)?.name ?? 'error'}).`);
        return 'failed';
      }
    },

    async unregister() {
      registeredFor = null;
      const token = store.get();
      if (!token) return;
      try {
        await devices.unregister(token);
        store.set(null);
      } catch {
        // Offline or session already gone: the next sign-in on this device claims the token.
      }
    },

    forget() {
      registeredFor = null;
      store.set(null);
    },
  };
}

let shared: PushRegistrar | null = null;

export function getPushRegistrar(): PushRegistrar {
  shared ??= createPushRegistrar({
    platform: getPushPlatform(),
    devices: getDevicesRepository(),
    store: kvTokenStore,
    channelName: () => i18n.t('notifications.channelName'),
  });
  return shared;
}
