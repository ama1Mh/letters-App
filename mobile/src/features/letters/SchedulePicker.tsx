import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ltrIsolate } from '@/core/i18n/bidi';
import { formatDate } from '@/core/i18n/format';
import type { Language } from '@/core/i18n/languages';
import { MIN_TOUCH_TARGET } from '@/core/theme/tokens';
import { useTheme } from '@/core/theme/useTheme';
import { SCHEDULE_MINUTE_STEP, addDays, addMinutes, utcOffsetLabel } from '@/domain/schedule';

interface SchedulePickerProps {
  value: Date;
  onChange: (value: Date) => void;
  language: Language;
  testID?: string;
}

/**
 * Small JS date/time picker for scheduled sends (DEC-048 (D1)): steppers for day, hour and minutes,
 * in the device's time zone, with the zone shown. Chosen over a native picker so the text follows
 * the in-app language with Western digits and the Gregorian calendar (OPEN-4 findings). Validation
 * (1 minute to 5 years ahead) is the caller's job, via validateScheduleTime().
 */
export function SchedulePicker({ value, onChange, language, testID }: SchedulePickerProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  const dateText = formatDate(value, language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeText = formatDate(value, language, { hour: 'numeric', minute: '2-digit' });
  const zoneName = safeTimeZoneName();
  const offset = utcOffsetLabel(value);
  const zoneText = ltrIsolate(zoneName ? `${zoneName} (${offset})` : offset);

  return (
    <View testID={testID} style={{ gap: spacing.sm }}>
      <AppText testID="schedule-date" variant="title">
        {dateText}
      </AppText>
      <AppText testID="schedule-time" variant="title">
        {timeText}
      </AppText>
      <AppText testID="schedule-zone" variant="muted">
        {t('schedule.timeZone', { zone: zoneText })}
      </AppText>
      <StepperRow
        id="day"
        label={t('schedule.dayLabel')}
        decreaseLabel={t('schedule.dayEarlier')}
        increaseLabel={t('schedule.dayLater')}
        onDecrease={() => onChange(addDays(value, -1))}
        onIncrease={() => onChange(addDays(value, 1))}
      />
      <StepperRow
        id="hour"
        label={t('schedule.hourLabel')}
        decreaseLabel={t('schedule.hourEarlier')}
        increaseLabel={t('schedule.hourLater')}
        onDecrease={() => onChange(addMinutes(value, -60))}
        onIncrease={() => onChange(addMinutes(value, 60))}
      />
      <StepperRow
        id="minute"
        label={t('schedule.minuteLabel', { step: SCHEDULE_MINUTE_STEP })}
        decreaseLabel={t('schedule.minuteEarlier', { step: SCHEDULE_MINUTE_STEP })}
        increaseLabel={t('schedule.minuteLater', { step: SCHEDULE_MINUTE_STEP })}
        onDecrease={() => onChange(addMinutes(value, -SCHEDULE_MINUTE_STEP))}
        onIncrease={() => onChange(addMinutes(value, SCHEDULE_MINUTE_STEP))}
      />
    </View>
  );
}

interface StepperRowProps {
  id: string;
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  onDecrease: () => void;
  onIncrease: () => void;
}

function StepperRow({
  id,
  label,
  decreaseLabel,
  increaseLabel,
  onDecrease,
  onIncrease,
}: StepperRowProps) {
  const { colors, spacing } = useTheme();
  // 48 dp circles: these are tapped repeatedly, often one-handed (Phase 10 accessibility pass).
  const buttonStyle = {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <AppText style={{ flex: 1 }}>{label}</AppText>
      <Pressable
        testID={`schedule-${id}-minus`}
        accessibilityRole="button"
        accessibilityLabel={decreaseLabel}
        onPress={onDecrease}
        style={buttonStyle}
      >
        <Ionicons name="remove" size={20} color={colors.primary} />
      </Pressable>
      <Pressable
        testID={`schedule-${id}-plus`}
        accessibilityRole="button"
        accessibilityLabel={increaseLabel}
        onPress={onIncrease}
        style={buttonStyle}
      >
        <Ionicons name="add" size={20} color={colors.primary} />
      </Pressable>
    </View>
  );
}

/** The device's IANA zone (e.g. `Asia/Riyadh`), or null if the JS engine does not report one;
 *  the UTC offset is always shown, so the picker never depends on this. */
function safeTimeZoneName(): string | null {
  try {
    const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === 'string' && zone.length > 0 ? zone : null;
  } catch {
    return null;
  }
}
