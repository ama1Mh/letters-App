import { isRecoveryUrl, parseRecoveryLink, stashRecoveryLink } from '@/features/auth/recoveryLink';

/**
 * Expo Router hands every incoming URL here first (cold and warm starts). The password-recovery
 * link carries its session tokens in the URL fragment, which the router would drop: keep them in
 * memory for the reset-password screen and route to the bare path (OPEN-10). Everything else
 * passes through unchanged.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (isRecoveryUrl(path)) {
      stashRecoveryLink(parseRecoveryLink(path));
      return '/reset-password';
    }
  } catch {
    // Never crash on a link: fall through to the router's own handling.
  }
  return path;
}
