/**
 * This device's push token on the server (Phase 7, DEC-050): `register_device` claims the token for
 * the signed-in user, `unregister_device` drops it (own token only). The table itself is never
 * written from the client, and the token is never read back.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabase } from '../supabase';

export type DevicePlatform = 'android' | 'ios';

export interface DevicesRepository {
  register(pushToken: string, platform: DevicePlatform, appVersion: string | null): Promise<void>;
  unregister(pushToken: string): Promise<void>;
}

export class DeviceRegistrationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'DeviceRegistrationError';
  }
}

function toError(error: { message?: string }): DeviceRegistrationError {
  const code = /^[a-z_]+$/.test(error.message ?? '') ? (error.message as string) : 'unknown';
  return new DeviceRegistrationError(code);
}

export function createDevicesRepository(client: SupabaseClient): DevicesRepository {
  return {
    async register(pushToken, platform, appVersion) {
      const { error } = await client.rpc('register_device', {
        p_push_token: pushToken,
        p_platform: platform,
        p_app_version: appVersion,
      });
      if (error) throw toError(error);
    },
    async unregister(pushToken) {
      const { error } = await client.rpc('unregister_device', { p_push_token: pushToken });
      if (error) throw toError(error);
    },
  };
}

let shared: DevicesRepository | null = null;

export function getDevicesRepository(): DevicesRepository {
  shared ??= createDevicesRepository(getSupabase());
  return shared;
}
