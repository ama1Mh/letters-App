import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { SwitchRow } from '@/components/SwitchRow';
import { MIN_TOUCH_TARGET } from '@/core/theme/tokens';
import { useTheme } from '@/core/theme/useTheme';
import type { ReceiveMode } from '@/data/supabase/auth';
import { useAuth } from '@/features/auth/AuthProvider';

const RECEIVE_MODES = [
  { value: 'everyone', labelKey: 'privacy.receiveModeEveryone' },
  { value: 'invite_only', labelKey: 'privacy.receiveModeInviteOnly' },
] as const satisfies readonly { value: ReceiveMode; labelKey: string }[];

/** Receive mode + discoverability (DEC-006). Writes directly via `profiles`' own column grants
 *  (DEC-038) - there is no dedicated RPC for this, unlike onboarding. Every change saves
 *  immediately, same as pick-design.tsx, and refreshes AuthProvider's cached profile. */
export default function PrivacyScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const auth = useAuth();
  const profile = auth.profile;

  const [receiveMode, setReceiveMode] = useState<ReceiveMode>(
    profile?.receiveMode ?? 'invite_only',
  );
  const [byUsername, setByUsername] = useState(profile?.discoverableByUsername ?? true);
  const [byEmail, setByEmail] = useState(profile?.discoverableByEmail ?? false);
  const [saveFailed, setSaveFailed] = useState(false);

  async function apply(
    patch: Partial<{
      receiveMode: ReceiveMode;
      discoverableByUsername: boolean;
      discoverableByEmail: boolean;
    }>,
  ) {
    const previous = {
      receiveMode,
      discoverableByUsername: byUsername,
      discoverableByEmail: byEmail,
    };
    const next = {
      receiveMode: patch.receiveMode ?? receiveMode,
      discoverableByUsername: patch.discoverableByUsername ?? byUsername,
      discoverableByEmail: patch.discoverableByEmail ?? byEmail,
    };
    const show = (values: typeof next) => {
      setReceiveMode(values.receiveMode);
      setByUsername(values.discoverableByUsername);
      setByEmail(values.discoverableByEmail);
    };
    show(next);
    setSaveFailed(false);
    try {
      await auth.repository.updateReceiveSettings(next);
    } catch {
      // A privacy control must never show a value the server does not have: put it back.
      show(previous);
      setSaveFailed(true);
      return;
    }
    await auth.refresh();
  }

  return (
    <ScrollView
      testID="privacy-screen"
      contentContainerStyle={{ paddingVertical: spacing.lg }}
      style={{ backgroundColor: colors.background }}
    >
      {saveFailed ? (
        <AppText
          testID="privacy-save-error"
          accessibilityLiveRegion="polite"
          style={{ color: colors.danger, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}
        >
          {t('privacy.saveError')}
        </AppText>
      ) : null}
      <AppText variant="muted" style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        {t('privacy.receiveModeLabel')}
      </AppText>
      {RECEIVE_MODES.map((mode) => {
        const checked = receiveMode === mode.value;
        return (
          <Pressable
            key={mode.value}
            testID={`privacy-receive-mode-${mode.value}`}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            onPress={() => void apply({ receiveMode: mode.value })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              minHeight: MIN_TOUCH_TARGET,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <AppText style={{ flex: 1 }}>{t(mode.labelKey)}</AppText>
            {checked ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
          </Pressable>
        );
      })}

      <View style={{ marginTop: spacing.lg }}>
        <SwitchRow
          testID="privacy-discoverable-by-username"
          label={t('privacy.discoverableByUsernameLabel')}
          value={byUsername}
          onValueChange={(next) => void apply({ discoverableByUsername: next })}
        />
        <SwitchRow
          testID="privacy-discoverable-by-email"
          label={t('privacy.discoverableByEmailLabel')}
          value={byEmail}
          onValueChange={(next) => void apply({ discoverableByEmail: next })}
        />
      </View>
    </ScrollView>
  );
}
