import {
  SCHEDULE_MINUTE_STEP,
  addDays,
  addMinutes,
  defaultScheduleTime,
  latestScheduleTime,
  utcOffsetLabel,
  validateScheduleTime,
} from '../src/domain/schedule';

// Local-time based on purpose (the user picks in device time); built from local components so the
// assertions hold in any time zone the tests run in.
const NOW = new Date(2026, 8, 29, 10, 0, 30); // 29 Sep 2026 10:00:30 local
const plusMs = (ms: number) => new Date(NOW.getTime() + ms);

describe('validateScheduleTime', () => {
  it('rejects now and anything earlier as in the past', () => {
    expect(validateScheduleTime(NOW, NOW)).toBe('schedule_in_past');
    expect(validateScheduleTime(plusMs(-1), NOW)).toBe('schedule_in_past');
  });

  it('rejects less than 1 minute ahead as too soon, and allows exactly 1 minute', () => {
    expect(validateScheduleTime(plusMs(1), NOW)).toBe('schedule_too_soon');
    expect(validateScheduleTime(plusMs(59_999), NOW)).toBe('schedule_too_soon');
    expect(validateScheduleTime(plusMs(60_000), NOW)).toBeNull();
  });

  it('allows exactly 5 calendar years ahead and rejects anything later', () => {
    const latest = latestScheduleTime(NOW);
    expect(latest.getFullYear()).toBe(2031);
    expect(validateScheduleTime(latest, NOW)).toBeNull();
    expect(validateScheduleTime(new Date(latest.getTime() + 1), NOW)).toBe('schedule_too_far');
  });
});

describe('defaultScheduleTime', () => {
  it('is at least 10 minutes ahead, on a whole minute step, with seconds cleared', () => {
    for (const now of [
      NOW,
      new Date(2026, 8, 29, 10, 5, 0),
      new Date(2026, 8, 29, 10, 7, 59),
      new Date(2026, 8, 29, 23, 58, 0), // rolls over midnight
    ]) {
      const at = defaultScheduleTime(now);
      expect(at.getTime() - now.getTime()).toBeGreaterThanOrEqual(10 * 60_000);
      expect(at.getTime() - now.getTime()).toBeLessThan(15 * 60_000);
      expect(at.getMinutes() % SCHEDULE_MINUTE_STEP).toBe(0);
      expect(at.getSeconds()).toBe(0);
      expect(validateScheduleTime(at, now)).toBeNull();
    }
  });

  it('keeps an exact step boundary instead of skipping a step', () => {
    expect(defaultScheduleTime(new Date(2026, 8, 29, 10, 5, 0))).toEqual(
      new Date(2026, 8, 29, 10, 15, 0),
    );
  });
});

describe('addDays / addMinutes', () => {
  it('moves by local calendar days, keeping the wall-clock time', () => {
    const at = new Date(2026, 8, 30, 9, 15);
    expect(addDays(at, 1)).toEqual(new Date(2026, 9, 1, 9, 15));
    expect(addDays(at, -1)).toEqual(new Date(2026, 8, 29, 9, 15));
  });

  it('moves by minutes across hour and day boundaries', () => {
    const at = new Date(2026, 8, 30, 23, 55);
    expect(addMinutes(at, 5)).toEqual(new Date(2026, 9, 1, 0, 0));
    expect(addMinutes(at, -60)).toEqual(new Date(2026, 8, 30, 22, 55));
  });
});

describe('utcOffsetLabel', () => {
  it('formats the device offset as UTC±HH:MM', () => {
    const label = utcOffsetLabel(NOW);
    expect(label).toMatch(/^UTC[+-]\d{2}:\d{2}$/);
    const offset = -NOW.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    expect(label.startsWith(`UTC${sign}`)).toBe(true);
  });

  it('handles positive, negative and half-hour offsets', () => {
    const fake = (offsetMinutes: number) =>
      ({ getTimezoneOffset: () => offsetMinutes }) as unknown as Date;
    expect(utcOffsetLabel(fake(-180))).toBe('UTC+03:00');
    expect(utcOffsetLabel(fake(240))).toBe('UTC-04:00');
    expect(utcOffsetLabel(fake(-330))).toBe('UTC+05:30');
    expect(utcOffsetLabel(fake(0))).toBe('UTC+00:00');
  });
});
