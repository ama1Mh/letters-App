import { redirectSystemPath } from '../app/+native-intent';
import {
  clearRecoveryLink,
  isRecoveryUrl,
  parseRecoveryLink,
  readRecoveryLink,
} from '@/features/auth/recoveryLink';

const OK =
  'letterapp://reset-password#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=recovery';

describe('Password-recovery link (OPEN-10)', () => {
  afterEach(() => clearRecoveryLink());

  it('reads the session tokens from the fragment (or the query)', () => {
    expect(parseRecoveryLink(OK)).toEqual({
      kind: 'recovery',
      accessToken: 'a.b.c',
      refreshToken: 'r1',
    });
    expect(
      parseRecoveryLink(
        'letterapp://reset-password?type=recovery&access_token=x%2By&refresh_token=r',
      ),
    ).toEqual({ kind: 'recovery', accessToken: 'x+y', refreshToken: 'r' });
  });

  it('treats an error, another link type, missing tokens or garbage as invalid', () => {
    for (const url of [
      'letterapp://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      'letterapp://reset-password#access_token=a&refresh_token=r&type=signup',
      'letterapp://reset-password#type=recovery&access_token=a',
      'letterapp://reset-password#%E0%A4%A',
      'letterapp://reset-password',
      '',
      null,
    ]) {
      expect(parseRecoveryLink(url)).toEqual({ kind: 'invalid' });
    }
  });

  it('recognizes only the reset-password path', () => {
    expect(isRecoveryUrl(OK)).toBe(true);
    expect(isRecoveryUrl('/reset-password')).toBe(true);
    expect(isRecoveryUrl('letterapp://invite/ABCD1234')).toBe(false);
    expect(isRecoveryUrl('letterapp://reset-passwords')).toBe(false);
    expect(isRecoveryUrl('https://evil.test/?next=reset-password')).toBe(false);
  });

  it('native intent: keeps the tokens in memory and routes to the bare path; other links pass through', () => {
    expect(redirectSystemPath({ path: OK, initial: true })).toBe('/reset-password');
    expect(readRecoveryLink()).toEqual({
      kind: 'recovery',
      accessToken: 'a.b.c',
      refreshToken: 'r1',
    });

    expect(redirectSystemPath({ path: 'letterapp://invite/ABCD1234', initial: false })).toBe(
      'letterapp://invite/ABCD1234',
    );
    clearRecoveryLink();
    expect(readRecoveryLink()).toEqual({ kind: 'invalid' });
  });
});
