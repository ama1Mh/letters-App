import { fireEvent, render, screen } from '@testing-library/react-native';

import { i18n, initI18n } from '../src/core/i18n';
import ar from '../src/core/i18n/locales/ar.json';
import en from '../src/core/i18n/locales/en.json';
import { utcOffsetLabel } from '../src/domain/schedule';
import { SchedulePicker } from '../src/features/letters/SchedulePicker';

const VALUE = new Date(2026, 9, 1, 14, 5); // Thu 1 Oct 2026, 14:05 local
const LRI = '⁦';
const PDI = '⁩';

beforeAll(() => {
  initI18n();
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('SchedulePicker', () => {
  it('shows the date, time and time zone in English with Western digits', async () => {
    await render(<SchedulePicker value={VALUE} onChange={() => {}} language="en" />);

    const date = screen.getByTestId('schedule-date').props.children as string;
    for (const part of ['Thursday', 'October', '1', '2026']) expect(date).toContain(part);
    expect(screen.getByTestId('schedule-time')).toHaveTextContent(/2:05\s?PM/);
    const zone = screen.getByTestId('schedule-zone');
    expect(zone).toHaveTextContent(new RegExp(`^${en.schedule.timeZone.split('{{')[0]}`));
    expect(zone).toHaveTextContent(utcOffsetLabel(VALUE), { exact: false });
  });

  it('shows Arabic text with Western (not Arabic-Indic) digits and an LTR-isolated zone', async () => {
    await i18n.changeLanguage('ar');
    await render(<SchedulePicker value={VALUE} onChange={() => {}} language="ar" />);

    const date = screen.getByTestId('schedule-date').props.children as string;
    const time = screen.getByTestId('schedule-time').props.children as string;
    expect(date).toMatch(/2026/);
    expect(date).toMatch(/أكتوبر/); // Gregorian month name, not a Hijri one
    expect(time).toMatch(/2:05/);
    expect(`${date}${time}`).not.toMatch(/[٠-٩]/); // no Arabic-Indic digits

    const zone = screen.getByTestId('schedule-zone').props.children as string;
    expect(zone.startsWith(ar.schedule.timeZone.split('{{')[0])).toBe(true);
    expect(zone).toContain(`${LRI}`);
    expect(zone.endsWith(PDI)).toBe(true);
    expect(zone).toContain(utcOffsetLabel(VALUE));
  });

  it('steps by a day, an hour and 5 minutes in both directions', async () => {
    const onChange = jest.fn();
    await render(<SchedulePicker value={VALUE} onChange={onChange} language="en" />);

    const cases: [string, Date][] = [
      ['schedule-day-plus', new Date(2026, 9, 2, 14, 5)],
      ['schedule-day-minus', new Date(2026, 8, 30, 14, 5)],
      ['schedule-hour-plus', new Date(2026, 9, 1, 15, 5)],
      ['schedule-hour-minus', new Date(2026, 9, 1, 13, 5)],
      ['schedule-minute-plus', new Date(2026, 9, 1, 14, 10)],
      ['schedule-minute-minus', new Date(2026, 9, 1, 14, 0)],
    ];
    for (const [testID, expected] of cases) {
      onChange.mockClear();
      await fireEvent.press(screen.getByTestId(testID));
      expect(onChange).toHaveBeenCalledWith(expected);
    }
  });

  it('gives every stepper button a translated accessibility label', async () => {
    await render(<SchedulePicker value={VALUE} onChange={() => {}} language="en" />);
    expect(screen.getByTestId('schedule-day-minus').props.accessibilityLabel).toBe(
      en.schedule.dayEarlier,
    );
    expect(screen.getByTestId('schedule-minute-plus').props.accessibilityLabel).toBe(
      'Move 5 minutes later',
    );
  });
});
