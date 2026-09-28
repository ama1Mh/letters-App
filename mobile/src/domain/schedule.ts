/**
 * Scheduled-send rules (DEC-046 (2), DEC-048 M3). Pure TypeScript: no React, no Supabase. The
 * server (`send_letter`, 20260927100000_send_min_lead_time.sql) is authoritative and applies the
 * same rules at send time; these mirror them so the app can explain a bad time before sending.
 * Any change here needs a matching migration.
 *
 * All arithmetic is in the device's local time zone (Date's local getters/setters), which is what
 * the user picks in; the chosen instant is sent to the server as UTC.
 */

/** Earliest schedule time: at least this far ahead (exactly 1 minute is allowed). */
export const SCHEDULE_MIN_LEAD_MS = 60_000;
/** Latest schedule time: at most this many calendar years ahead (`interval '5 years'`). */
export const SCHEDULE_MAX_LEAD_YEARS = 5;
/** Default suggestion: at least this far ahead, rounded up to the minute step. */
export const SCHEDULE_DEFAULT_LEAD_MS = 10 * 60_000;
/** The picker's minute stepper moves in steps of this size. */
export const SCHEDULE_MINUTE_STEP = 5;

export type ScheduleErrorCode = 'schedule_in_past' | 'schedule_too_soon' | 'schedule_too_far';

export function latestScheduleTime(now: Date): Date {
  const latest = new Date(now.getTime());
  latest.setFullYear(latest.getFullYear() + SCHEDULE_MAX_LEAD_YEARS);
  return latest;
}

/** Same order and boundaries as the server: past, then too soon, then too far. */
export function validateScheduleTime(at: Date, now: Date): ScheduleErrorCode | null {
  if (at.getTime() <= now.getTime()) return 'schedule_in_past';
  if (at.getTime() < now.getTime() + SCHEDULE_MIN_LEAD_MS) return 'schedule_too_soon';
  if (at.getTime() > latestScheduleTime(now).getTime()) return 'schedule_too_far';
  return null;
}

/** `now` + the default lead, rounded up to the next whole minute step, seconds cleared. */
export function defaultScheduleTime(now: Date): Date {
  const at = new Date(now.getTime() + SCHEDULE_DEFAULT_LEAD_MS);
  at.setSeconds(0, 0);
  const remainder = at.getMinutes() % SCHEDULE_MINUTE_STEP;
  if (remainder !== 0 || at.getTime() < now.getTime() + SCHEDULE_DEFAULT_LEAD_MS) {
    at.setMinutes(at.getMinutes() + (SCHEDULE_MINUTE_STEP - remainder));
  }
  return at;
}

/** Moves by whole local calendar days, keeping the wall-clock time (DST-safe). */
export function addDays(at: Date, days: number): Date {
  const next = new Date(at.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

/** Moves by wall-clock minutes (hour steps are 60). */
export function addMinutes(at: Date, minutes: number): Date {
  const next = new Date(at.getTime());
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

/** `UTC+03:00`, `UTC-04:30`, `UTC+00:00` for the device's offset at that instant (DST-aware). */
export function utcOffsetLabel(at: Date): string {
  const offsetMinutes = -at.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hours}:${minutes}`;
}
