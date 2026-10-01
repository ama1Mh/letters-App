/**
 * Registers this device for delivery notifications (Phase 7, DEC-050). Push is only a hint (the
 * inbox is the source of truth, PLAN §5), so nothing here ever throws to the caller: every step
 * that can fail (no permission, no FCM/EAS configuration yet, offline, rate limit) just leaves the
 * device unregistered and reports why.
 *
 * - `register(userId)` runs when a user reaches `ready`. It registers at most once per user per app
 *   run: `AuthProvider` re-applies the session on every token refresh, and `register_device` is
 *   rate-limited (30 a day). Across runs, the same token for the same user is re-sent at most once
 *   a day (`RegistrationMemo`): phone QA on 2026-10-01 hit the daily limit just by cold-starting the
 *   app often, which would leave a rotated FCM token unregistered for the rest of the day.
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
const MEMO_KEY = 'push.lastRegistration';
/** Re-send an unchanged registration at most this often (keeps `last_seen_at` roughly current). */
export const REREGISTER_AFTER_MS = 24 * 60 * 60 * 1000;

/** The last successful registration, so an unchanged token is not re-sent on every cold start. */
export interface RegistrationMemo {
  get(): { userId: string; token: string; at: number } | null;
  set(value: { userId: string; token: string; at: number } | null): void;
}

export const kvRegistrationMemo: RegistrationMemo = {
  get() {
    try {
      const raw = Storage.getItemSync(MEMO_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw) as { userId?: unknown; token?: unknown; at?: unknown };
      return typeof value.userId === 'string' &&
        typeof value.token === 'string' &&
        typeof value.at === 'number'
        ? { userId: value.userId, token: value.token, at: value.at }
        : null;
    } catch {
      return null;
    }
  },
  set(value) {
    try {
      if (value === null) Storage.removeItemSync(MEMO_KEY);
      else Storage.setItemSync(MEMO_KEY, JSON.stringify(value));
    } catch {
      // Best effort: without the memo the next run simply registers again.
    }
  },
};

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
  /** Optional: skip re-sending an unchanged registration (the app passes the kv-backed one). */
  memo?: RegistrationMemo;
  now?: () => number;
}

export function createPushRegistrar({
  platform,
  devices,
  store,
  channelName,
  memo,
  now = Date.now,
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
        const last = memo?.get();
        if (
          last &&
          last.userId === userId &&
          last.token === token &&
          store.get() === token &&
          now() - last.at < REREGISTER_AFTER_MS
        ) {
          registeredFor = userId;
          return 'alreadyRegistered';
        }
        await devices.register(token, platform.os, platform.appVersion);
        store.set(token);
        memo?.set({ userId, token, at: now() });
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
      memo?.set(null);
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
      memo?.set(null);
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
    memo: kvRegistrationMemo,
  });
  return shared;
}
