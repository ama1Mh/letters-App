/**
 * Delivery notifications in the running app (Phase 7): registers this device once the user is
 * `ready`, and opens `/letter/<id>` when one of our notifications is tapped (PLAN §5 step 7).
 *
 * A tap that arrives before the user is `ready` (cold start while the auth gate is still loading,
 * or signed out) is held and opened once they are, and only after the gate (`app/index`) or the
 * (auth) screens have redirected into the app, which would otherwise replace the letter again. The reading view does the permission check:
 * a letter that is not the signed-in user's shows the same neutral `not_found` as any other.
 */
import { useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { getPushPlatform } from './pushPlatform';
import { getPushRegistrar } from './pushRegistrar';

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { status, profile } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const inApp = segments.length > 0 && segments[0] !== '(auth)';
  const userId = status === 'ready' ? (profile?.id ?? null) : null;
  // The letter to open once the user is in the app; `taps` only re-runs the effect below.
  const pendingLetterId = useRef<string | null>(null);
  const [taps, setTaps] = useState(0);

  useEffect(() => {
    const platform = getPushPlatform();
    pendingLetterId.current ??= platform.takeLaunchLetterId();
    return platform.onLetterTapped((letterId) => {
      pendingLetterId.current = letterId;
      setTaps((count) => count + 1);
    });
  }, []);

  useEffect(() => {
    if (userId) void getPushRegistrar().register(userId);
  }, [userId]);

  useEffect(() => {
    const letterId = pendingLetterId.current;
    if (!userId || !inApp || !letterId) return;
    pendingLetterId.current = null;
    router.push({ pathname: '/letter/[id]', params: { id: letterId } });
  }, [userId, inApp, taps, router]);

  return children;
}
