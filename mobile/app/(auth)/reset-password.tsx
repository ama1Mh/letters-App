import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/core/theme/useTheme';
import { AuthActionError, type UpdatePasswordErrorCode } from '@/data/supabase/auth';
import { useAuth } from '@/features/auth/AuthProvider';
import { clearRecoveryLink, readRecoveryLink } from '@/features/auth/recoveryLink';

const KNOWN_CODES: readonly UpdatePasswordErrorCode[] = ['weak_password', 'same_password'];

type Step = 'starting' | 'invalid' | 'form' | 'done';

/**
 * Where the password-recovery email lands (OPEN-10, via app/+native-intent.tsx). Starts the
 * recovery session the link carries, then sets the new password; the user ends up signed in.
 * An expired, used or missing link shows one neutral message and a way to request a new email.
 * If another account is signed in on this device, it is signed out properly first (push
 * unregistered, local drafts synced and cleared), as on any account switch.
 */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const auth = useAuth();
  const [link] = useState(readRecoveryLink);
  const [step, setStep] = useState<Step>(link.kind === 'recovery' ? 'starting' : 'invalid');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const { status, signOut, repository } = auth;

  useEffect(() => {
    if (link.kind !== 'recovery' || started.current || status === 'loading') return;
    started.current = true;
    void (async () => {
      try {
        if (status !== 'signedOut') await signOut();
        await repository.startPasswordRecovery(link);
        clearRecoveryLink();
        setStep('form');
      } catch {
        clearRecoveryLink();
        setStep('invalid');
      }
    })();
  }, [link, status, signOut, repository]);

  async function onSubmit() {
    setError(null);
    if (password !== confirm) {
      setError(t('auth.resetPassword.error.mismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await repository.updatePassword(password);
      setStep('done');
    } catch (e) {
      const code = e instanceof AuthActionError ? (e.code as UpdatePasswordErrorCode) : 'unknown';
      if (code === 'session_not_found' || code === 'invalid_link') setStep('invalid');
      else setError(t(`auth.resetPassword.error.${KNOWN_CODES.includes(code) ? code : 'unknown'}`));
    } finally {
      setSubmitting(false);
    }
  }

  const container = {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
    justifyContent: 'center' as const,
  };

  if (step === 'starting') {
    return (
      <View testID="reset-password-starting" style={container}>
        <ActivityIndicator />
        <AppText variant="muted" style={{ textAlign: 'center' }}>
          {t('auth.resetPassword.checking')}
        </AppText>
      </View>
    );
  }

  if (step === 'invalid') {
    return (
      <View testID="reset-password-invalid" style={container}>
        <AppText variant="title">{t('auth.resetPassword.invalidTitle')}</AppText>
        <AppText>{t('auth.resetPassword.invalidBody')}</AppText>
        <Button
          testID="reset-password-request-new"
          title={t('auth.resetPassword.requestNew')}
          onPress={() => router.replace('/forgot-password')}
        />
        <Pressable testID="reset-password-back" onPress={() => router.replace('/')}>
          <AppText style={{ color: colors.primary }}>
            {t('auth.forgotPassword.backToSignIn')}
          </AppText>
        </Pressable>
      </View>
    );
  }

  if (step === 'done') {
    return (
      <View testID="reset-password-done" style={container}>
        <AppText variant="title">{t('auth.resetPassword.doneTitle')}</AppText>
        <AppText>{t('auth.resetPassword.doneBody')}</AppText>
        <Button
          testID="reset-password-continue"
          title={t('auth.resetPassword.continue')}
          onPress={() => router.replace('/')}
        />
      </View>
    );
  }

  return (
    <View testID="reset-password-screen" style={container}>
      <AppText variant="title">{t('auth.resetPassword.title')}</AppText>
      <TextField
        testID="reset-password-new"
        label={t('auth.resetPassword.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        testID="reset-password-confirm"
        label={t('auth.resetPassword.confirm')}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {error ? (
        <AppText testID="reset-password-error" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
      <Button
        testID="reset-password-submit"
        title={t('auth.resetPassword.submit')}
        onPress={() => void onSubmit()}
        loading={submitting}
        disabled={!password || !confirm}
      />
    </View>
  );
}
