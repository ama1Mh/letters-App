/**
 * The only module that talks to `expo-notifications` (PLAN §8: platform bits behind small modules,
 * so iOS is configuration). Tests replace `getPushPlatform()` with a fake.
 *
 * Getting an Expo push token needs the EAS project id (`extra.eas.projectId`, set from
 * `EAS_PROJECT_ID` in app.config.ts) and, on Android, Firebase (`GOOGLE_SERVICES_JSON`). Until the
 * owner creates both (DEC-050 (3)), `getToken()` returns null for the missing project id, or throws
 * for missing Firebase, and the registrar simply leaves the device unregistered.
 */
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Must match `channelId` in supabase/functions/send-notifications. */
export const LETTERS_CHANNEL_ID = 'letters';

export interface PushPlatform {
  os: 'android' | 'ios' | 'other';
  appVersion: string | null;
  /** Android: creates or renames the `letters` channel. No-op elsewhere. */
  ensureChannel(name: string): Promise<void>;
  /** Asks only when not decided yet (Android 13+ / iOS show the system prompt once). */
  requestPermission(): Promise<boolean>;
  /** The Expo push token, or null when this build has no EAS project id. */
  getToken(): Promise<string | null>;
  /** The letter id of the notification that cold-started the app, if any (consumed once). */
  takeLaunchLetterId(): string | null;
  /** Calls back with the letter id whenever the user taps one of our notifications. */
  onLetterTapped(listener: (letterId: string) => void): () => void;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The payload is `{ letter_id }` only (no letter text, PLAN §6.5); anything else is ignored. */
export function letterIdFromResponse(
  response: Pick<Notifications.NotificationResponse, 'notification' | 'actionIdentifier'> | null,
): string | null {
  if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    return null;
  }
  const value: unknown = response.notification.request.content.data?.letter_id;
  return typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : null;
}

function readProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const id = extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

let handlerSet = false;

/**
 * Lets our notifications show while the app is in the foreground. Without a JS handler,
 * expo-notifications drops a foreground notification entirely, so this must run at module load
 * (app/_layout.tsx), not in an effect after the first render: on 2026-10-01 a delivery that
 * reached the app while it was still building its first screens after a cold start was never
 * shown. Idempotent. (Before the JS bundle has run at all, nothing can be shown in the foreground;
 * the letter still appears in the inbox through Realtime / the next refresh.)
 */
export function installForegroundNotificationHandler(): void {
  if (handlerSet) return;
  handlerSet = true;
  // In the foreground the inbox refreshes live (Realtime); still show the banner so the user
  // notices, but no sound or badge.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function createNativePushPlatform(): PushPlatform {
  installForegroundNotificationHandler();
  const os = Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : 'other';

  return {
    os,
    appVersion: Constants.expoConfig?.version ?? null,

    async ensureChannel(name) {
      if (os !== 'android') return;
      await Notifications.setNotificationChannelAsync(LETTERS_CHANNEL_ID, {
        name,
        importance: Notifications.AndroidImportance.HIGH,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      });
    },

    async requestPermission() {
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      if (!current.canAskAgain) return false;
      return (await Notifications.requestPermissionsAsync()).granted;
    },

    async getToken() {
      const projectId = readProjectId();
      if (!projectId) return null;
      return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    },

    takeLaunchLetterId() {
      const id = letterIdFromResponse(Notifications.getLastNotificationResponse());
      if (id) Notifications.clearLastNotificationResponse();
      return id;
    },

    onLetterTapped(listener) {
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const id = letterIdFromResponse(response);
        if (id) listener(id);
      });
      return () => subscription.remove();
    },
  };
}

let shared: PushPlatform | null = null;

export function getPushPlatform(): PushPlatform {
  shared ??= createNativePushPlatform();
  return shared;
}
