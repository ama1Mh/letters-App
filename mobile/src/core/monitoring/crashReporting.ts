/**
 * Crash reporting (DEC-032: Sentry; DEC-057). Off unless `EXPO_PUBLIC_SENTRY_DSN` is set at bundle
 * time (a DSN is public by design: it only allows sending events). When on, it sends crashes and
 * unhandled errors only, stripped down to what is needed to fix them:
 * - no user, IP or request data (`sendDefaultPii: false`, `user`/`request` removed);
 * - no breadcrumbs (they can hold console output, URLs and screen params), screenshots, view
 *   hierarchy (it would contain on-screen text such as letters), sessions or performance tracing;
 * - error messages are scrubbed of email addresses, URL queries/fragments and invite codes.
 * Our own errors are codes already (CLAUDE.md), so the scrubbing is for third-party messages.
 */
import * as Sentry from '@sentry/react-native';

export const SENTRY_DSN_VARIABLE = 'EXPO_PUBLIC_SENTRY_DSN';

const EMAIL = /[^\s@<>()"']+@[^\s@<>()"']+\.[a-z]{2,}/gi;
const URL_TAIL = /(\b[a-z][a-z0-9+.-]*:\/\/[^\s?#]*)[?#][^\s]*/gi;
const INVITE_PATH = /(\binvite\/)[A-Za-z0-9]+/g;

/** Removes anything personal we know how to recognise from free text. Pure; unit-tested. */
export function scrubText(text: string): string {
  return text.replace(EMAIL, '[email]').replace(URL_TAIL, '$1[…]').replace(INVITE_PATH, '$1[code]');
}

type SentryEvent = Sentry.ErrorEvent;

/** `beforeSend`: drops user/request data and scrubs messages and exception values. */
export function scrubEvent(event: SentryEvent): SentryEvent {
  delete event.user;
  delete event.request;
  delete event.breadcrumbs;
  delete event.extra;
  if (event.message) event.message = scrubText(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(exception.value);
  }
  return event;
}

let started = false;

/**
 * Starts Sentry once, before the first render. Returns whether it is on. Expo inlines
 * `process.env.EXPO_PUBLIC_*` only when spelled out statically, so keep the lookup as it is.
 */
export function initCrashReporting(options: { environment: string; release?: string }): boolean {
  if (started) return true;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: options.environment,
    release: options.release,
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableAutoSessionTracking: false,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: () => null,
  });
  started = true;
  return true;
}
