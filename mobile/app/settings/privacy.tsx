import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
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

  async function apply(
    patch: Partial<{
      receiveMode: ReceiveMode;
      discoverableByUsername: boolean;
      discoverableByEmail: boolean;
    }>,
  ) {
    const next = {
      receiveMode: patch.receiveMode ?? receiveMode,
      discoverableByUsername: patch.discoverableByUsername ?? byUsername,
      discoverableByEmail: patch.discoverableByEmail ?? byEmail,
    };
    setReceiveMode(next.receiveMode);
    setByUsername(next.discoverableByUsername);
    setByEmail(next.discoverableByEmail);
    await auth.repository.updateReceiveSettings(next);
    await auth.refresh();
  }

  return (
    <ScrollView
      testID="privacy-screen"
      contentContainerStyle={{ paddingVertical: spacing.lg }}
      style={{ backgroundColor: colors.background }}
    >
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

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          marginTop: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText style={{ flex: 1 }}>{t('privacy.discoverableByUsernameLabel')}</AppText>
        <Switch
          testID="privacy-discoverable-by-username"
          value={byUsername}
          onValueChange={(next) => void apply({ discoverableByUsername: next })}
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText style={{ flex: 1 }}>{t('privacy.discoverableByEmailLabel')}</AppText>
        <Switch
          testID="privacy-discoverable-by-email"
          value={byEmail}
          onValueChange={(next) => void apply({ discoverableByEmail: next })}
        />
      </View>
    </ScrollView>
  );
}
