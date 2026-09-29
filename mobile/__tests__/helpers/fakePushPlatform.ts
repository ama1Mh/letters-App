import type { DevicesRepository } from '@/data/notifications/devicesRepository';
import type { PushPlatform } from '@/features/notifications/pushPlatform';

export const FAKE_PUSH_TOKEN = 'ExponentPushToken[fakeshelltoken]';

export interface FakePushPlatform extends PushPlatform {
  /** Simulates the user tapping a delivery notification for this letter. */
  tap(letterId: string): void;
}

export function createFakePushPlatform(launchLetterId: string | null = null): FakePushPlatform {
  const listeners = new Set<(letterId: string) => void>();
  let launch = launchLetterId;
  return {
    os: 'android',
    appVersion: '1.0.0',
    ensureChannel: jest.fn(async () => {}),
    requestPermission: jest.fn(async () => true),
    getToken: jest.fn(async () => FAKE_PUSH_TOKEN),
    takeLaunchLetterId() {
      const id = launch;
      launch = null;
      return id;
    },
    onLetterTapped(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    tap(letterId) {
      for (const listener of listeners) listener(letterId);
    },
  };
}

export function createFakeDevicesRepository(): jest.Mocked<DevicesRepository> {
  return {
    register: jest.fn<Promise<void>, Parameters<DevicesRepository['register']>>(async () => {}),
    unregister: jest.fn<Promise<void>, Parameters<DevicesRepository['unregister']>>(async () => {}),
  };
}
