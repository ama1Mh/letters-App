import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/core/theme/useTheme';
import { AuthActionError, type UpdateDisplayNameErrorCode } from '@/data/supabase/auth';
import { validateDisplayName } from '@/domain/displayName';
import { useAuth } from '@/features/auth/AuthProvider';

const KNOWN_CODES: readonly UpdateDisplayNameErrorCode[] = [
  'not_authenticated',
  'display_name_invalid',
  'display_name_reserved',
];

/**
 * Change the display name chosen at onboarding (owner request, 2026-10-04). Same rules as
 * onboarding (`validateDisplayName`, the database's CHECK and reserved-word trigger); the
 * @username never changes here. Letters already delivered show the new name too, since every
 * list reads the current profile.
 */
export default function DisplayNameScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { profile, repository, refresh } = useAuth();
  const current = profile?.displayName ?? '';
  const [displayName, setDisplayName] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const result = validateDisplayName(displayName);
  const fieldError =
    displayName.length > 0 && !result.ok
      ? t(`auth.onboarding.displayNameError.${result.code}`)
      : undefined;
  const unchanged = result.ok && result.displayName === current;
  const canSave = result.ok && !unchanged && !saving;

  async function onSave() {
    if (!result.ok) return;
    setError(null);
    setSaving(true);
    try {
      await repository.updateDisplayName(result.displayName);
      await refresh();
      router.back();
    } catch (e) {
      const code =
        e instanceof AuthActionError ? (e.code as UpdateDisplayNameErrorCode) : 'unknown';
      setError(t(`auth.onboarding.error.${KNOWN_CODES.includes(code) ? code : 'unknown'}`));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormScreen testID="display-name-screen">
      <View style={{ gap: spacing.xs }}>
        <TextField
          testID="display-name-input"
          label={t('auth.onboarding.displayNameLabel')}
          value={displayName}
          onChangeText={setDisplayName}
          autoFocus
          error={fieldError}
        />
        {!fieldError ? (
          <AppText variant="muted">{t('auth.onboarding.displayNameHint')}</AppText>
        ) : null}
      </View>
      {error ? (
        <AppText testID="display-name-error" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
      <Button
        testID="display-name-save"
        title={t('displayName.save')}
        onPress={() => void onSave()}
        loading={saving}
        disabled={!canSave}
      />
    </FormScreen>
  );
}
