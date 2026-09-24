import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { currentLanguage } from '@/core/i18n';
import { useTheme } from '@/core/theme/useTheme';
import { AuthActionError, type OnboardingErrorCode } from '@/data/supabase/auth';
import { validateDisplayName } from '@/domain/displayName';
import { validateUsername } from '@/domain/username';
import { useAuth } from '@/features/auth/AuthProvider';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'unavailable';

const KNOWN_CODES: readonly OnboardingErrorCode[] = [
  'not_authenticated',
  'invalid_input',
  'username_invalid',
  'display_name_invalid',
  'username_unavailable',
  'display_name_reserved',
  'profile_not_found',
  'already_onboarded',
];

const USERNAME_CHECK_DEBOUNCE_MS = 400;

/**
 * `locale` is submitted as the current UI language rather than asked again here: the user already
 * chose it (System/English/العربية, Settings > Language) before reaching sign-up, so a second
 * picker on this screen would just repeat that choice.
 */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const auth = useAuth();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [discoverableByEmail, setDiscoverableByEmail] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkSeq = useRef(0);

  const usernameResult = validateUsername(username);
  const displayNameResult = validateDisplayName(displayName);

  useEffect(() => {
    if (!usernameResult.ok) return; // nothing to check; render falls back to 'idle' below
    const seq = ++checkSeq.current;
    const timer = setTimeout(() => {
      // setState belongs in the timer callback, not the effect body itself, so this only ever
      // runs in response to the debounce firing (react-hooks/set-state-in-effect).
      setUsernameStatus('checking');
      void auth.repository
        .checkUsernameAvailable(usernameResult.username)
        .then((available) => {
          if (checkSeq.current === seq) setUsernameStatus(available ? 'available' : 'unavailable');
        })
        .catch(() => {
          if (checkSeq.current === seq) setUsernameStatus('idle');
        });
    }, USERNAME_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `usernameResult` is derived from `username` each render; depending on the string keeps this
    // from re-running for reasons other than the text actually changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // The username field's own validity always wins: a stale 'available'/'checking' from a previous,
  // now-edited value must never be displayed or allowed to submit.
  const displayedUsernameStatus: UsernameStatus = usernameResult.ok ? usernameStatus : 'idle';
  const canSubmit =
    usernameResult.ok &&
    displayNameResult.ok &&
    displayedUsernameStatus === 'available' &&
    !submitting;

  async function onSubmit() {
    if (!usernameResult.ok || !displayNameResult.ok) return;
    setError(null);
    setSubmitting(true);
    try {
      await auth.repository.completeOnboarding({
        username: usernameResult.username,
        displayName: displayNameResult.displayName,
        locale: currentLanguage(),
        discoverableByEmail,
      });
      await auth.refresh();
      router.replace('/');
    } catch (e) {
      const code = e instanceof AuthActionError ? (e.code as OnboardingErrorCode) : 'unknown';
      setError(t(`auth.onboarding.error.${KNOWN_CODES.includes(code) ? code : 'unknown'}`));
    } finally {
      setSubmitting(false);
    }
  }

  const usernameError =
    username.length > 0 && !usernameResult.ok
      ? t(`auth.onboarding.usernameError.${usernameResult.code}`)
      : displayedUsernameStatus === 'unavailable'
        ? t('auth.onboarding.usernameUnavailable')
        : undefined;

  const usernameHelp =
    displayedUsernameStatus === 'checking'
      ? t('auth.onboarding.usernameChecking')
      : displayedUsernameStatus === 'available'
        ? t('auth.onboarding.usernameAvailable')
        : t('auth.onboarding.usernameHint');

  const displayNameError =
    displayName.length > 0 && !displayNameResult.ok
      ? t(`auth.onboarding.displayNameError.${displayNameResult.code}`)
      : undefined;

  return (
    <View
      testID="onboarding-screen"
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
        gap: spacing.md,
        justifyContent: 'center',
      }}
    >
      <AppText variant="title">{t('auth.onboarding.title')}</AppText>
      <View style={{ gap: spacing.xs }}>
        <TextField
          testID="onboarding-username"
          label={t('auth.onboarding.usernameLabel')}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          error={usernameError}
        />
        {!usernameError ? <AppText variant="muted">{usernameHelp}</AppText> : null}
      </View>
      <View style={{ gap: spacing.xs }}>
        <TextField
          testID="onboarding-display-name"
          label={t('auth.onboarding.displayNameLabel')}
          value={displayName}
          onChangeText={setDisplayName}
          error={displayNameError}
        />
        {!displayNameError ? (
          <AppText variant="muted">{t('auth.onboarding.displayNameHint')}</AppText>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText style={{ flex: 1 }}>{t('auth.onboarding.discoverableByEmailLabel')}</AppText>
        <Switch
          testID="onboarding-discoverable-by-email"
          value={discoverableByEmail}
          onValueChange={setDiscoverableByEmail}
        />
      </View>
      {error ? (
        <AppText testID="onboarding-error" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
      <Button
        testID="onboarding-submit"
        title={t('auth.onboarding.submit')}
        onPress={() => void onSubmit()}
        loading={submitting}
        disabled={!canSubmit}
      />
    </View>
  );
}
