/**
 * Reads the password-recovery deep link (OPEN-10). `requestPasswordReset()` sends an email whose
 * link goes through Supabase's verify endpoint and then redirects to `<scheme>://reset-password`
 * with the result in the URL fragment (the client uses the implicit flow):
 *   ...#access_token=...&refresh_token=...&expires_in=3600&token_type=bearer&type=recovery
 *   ...#error=access_denied&error_code=otp_expired&error_description=...
 * Query parameters are accepted too, in case a platform moves the fragment into the query.
 *
 * The tokens are credentials: never log the URL or the result.
 */
export type RecoveryLink =
  | { kind: 'recovery'; accessToken: string; refreshToken: string }
  /** Expired, already used, or not a recovery link: the user must request a new email. */
  | { kind: 'invalid' };

// Hand-parsed: React Native's URLSearchParams has historically been incomplete, and Jest (Node)
// would not show it.
function readPairs(part: string, into: Map<string, string>) {
  for (const pair of part.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
    try {
      into.set(
        decodeURIComponent(rawKey.replace(/\+/g, ' ')),
        decodeURIComponent(rawValue.replace(/\+/g, ' ')),
      );
    } catch {
      // Malformed escape: ignore the pair.
    }
  }
}

function params(url: string): Map<string, string> {
  const merged = new Map<string, string>();
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  if (queryIndex !== -1 && (hashIndex === -1 || queryIndex < hashIndex)) {
    readPairs(url.slice(queryIndex + 1, hashIndex === -1 ? url.length : hashIndex), merged);
  }
  if (hashIndex !== -1) readPairs(url.slice(hashIndex + 1), merged);
  return merged;
}

export function parseRecoveryLink(url: string | null | undefined): RecoveryLink {
  if (!url) return { kind: 'invalid' };
  const p = params(url);
  const accessToken = p.get('access_token');
  const refreshToken = p.get('refresh_token');
  if (p.get('error') || p.get('error_code') || p.get('type') !== 'recovery') {
    return { kind: 'invalid' };
  }
  if (!accessToken || !refreshToken) return { kind: 'invalid' };
  return { kind: 'recovery', accessToken, refreshToken };
}

// Held in memory only, between app/+native-intent.tsx (which sees the raw URL) and the
// reset-password screen, so the tokens never enter navigation state, params or storage.
let pending: RecoveryLink | null = null;

/** True for `<scheme>://reset-password...` (and a bare `/reset-password...` path). */
export function isRecoveryUrl(url: string): boolean {
  return /^([a-z][a-z0-9.+-]*:\/\/)?\/?reset-password(?:[/?#]|$)/i.test(url);
}

export function stashRecoveryLink(link: RecoveryLink): void {
  pending = link;
}

/** Non-destructive, so a re-render cannot lose it; cleared once the session has started. */
export function readRecoveryLink(): RecoveryLink {
  return pending ?? { kind: 'invalid' };
}

export function clearRecoveryLink(): void {
  pending = null;
}
