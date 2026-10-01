import { Pressable, Switch } from 'react-native';

import { MIN_TOUCH_TARGET } from '@/core/theme/tokens';
import { useTheme } from '@/core/theme/useTheme';

import { AppText } from './AppText';

interface SwitchRowProps {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** On the Switch itself (tests fire `valueChange` on it); the row gets `${testID}-row`. */
  testID: string;
  disabled?: boolean;
  /** Inside a padded form (onboarding): no side padding or divider. */
  plain?: boolean;
}

/**
 * A labelled on/off setting where the whole row is the control: one 48 dp+ touch target and one
 * TalkBack item ("label, switch, on") instead of a text plus a tiny unlabelled-looking switch
 * (Phase 10 accessibility pass on the phone: the bare Switch was 47 x 27 dp).
 */
export function SwitchRow({
  label,
  value,
  onValueChange,
  testID,
  disabled,
  plain = false,
}: SwitchRowProps) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      testID={`${testID}-row`}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: disabled === true }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: MIN_TOUCH_TARGET,
        paddingHorizontal: plain ? 0 : spacing.lg,
        paddingVertical: plain ? spacing.xs : spacing.md,
        borderBottomWidth: plain ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <AppText style={{ flex: 1 }}>{label}</AppText>
      {/* Hidden from TalkBack: the row already announces label, role and state. */}
      <Switch
        testID={testID}
        accessibilityLabel={label}
        importantForAccessibility="no"
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
      />
    </Pressable>
  );
}
