import * as Sentry from '@sentry/react-native';

import { initCrashReporting, scrubEvent, scrubText } from '@/core/monitoring/crashReporting';

describe('crash reporting', () => {
  it('scrubs emails, URL queries and invite codes from free text', () => {
    expect(scrubText('lookup failed for sara@example.com')).toBe('lookup failed for [email]');
    expect(scrubText('GET https://x.supabase.co/rest/v1/profiles?username=eq.sara failed')).toBe(
      'GET https://x.supabase.co/rest/v1/profiles[…] failed',
    );
    expect(scrubText('could not open letterapp://invite/ABCD2345XY')).toBe(
      'could not open letterapp://invite/[code]',
    );
    expect(scrubText('TypeError: undefined is not a function')).toBe(
      'TypeError: undefined is not a function',
    );
  });

  it('drops user, request, breadcrumbs and extra data, and scrubs exception values', () => {
    const event = scrubEvent({
      type: undefined,
      message: 'mail me at a@b.co',
      user: { id: 'u1', email: 'a@b.co' },
      request: { url: 'https://x' },
      breadcrumbs: [{ message: 'console: body text' }],
      extra: { body: 'Dear Sara' },
      exception: { values: [{ type: 'Error', value: 'bad a@b.co' }] },
    });
    expect(event.user).toBeUndefined();
    expect(event.request).toBeUndefined();
    expect(event.breadcrumbs).toBeUndefined();
    expect(event.extra).toBeUndefined();
    expect(event.message).toBe('mail me at [email]');
    expect(event.exception?.values?.[0].value).toBe('bad [email]');
  });

  it('stays off without a DSN', () => {
    expect(initCrashReporting({ environment: 'dev' })).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });
});
