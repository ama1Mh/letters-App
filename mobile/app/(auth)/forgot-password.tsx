import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/core/theme/useTheme';
import { AuthActionError, type ResetPasswordErrorCode } from '@/data/supabase/auth';
import { useAuth } from '@/features/auth/AuthProvider';

const KNOWN_CODES: readonly ResetPasswordErrorCode[] = [
  'over_email_send_rate_limit',
  'over_request_rate_limit',
];

/**
 * Only sends the reset email. There is deliberately no screen yet to consume the link it points
 * to: that needs the redirect URL allow-listed in the Supabase dashboard (a cloud config change)
 * and a "set new password" screen. See OPEN-10 in docs/DECISIONS.md.
 */
export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const auth = useAuth();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const trimmed = email.trim();
      await auth.repository.requestPasswordReset(trimmed);
      setSentTo(trimmed);
    } catch (e) {
      const code = e instanceof AuthActionError ? (e.code as ResetPasswordErrorCode) : 'unknown';
      setError(t(`auth.forgotPassword.error.${KNOWN_CODES.includes(code) ? code : 'unknown'}`));
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <View
        testID="forgot-password-confirmation"
        style={{
          flex: 1,
          backgroundColor: colors.background,
          padding: spacing.lg,
          gap: spacing.sm,
          justifyContent: 'center',
        }}
      >
        <AppText variant="title">{t('auth.forgotPassword.confirmationTitle')}</AppText>
        <AppText>{t('auth.forgotPassword.confirmationBody', { email: sentTo })}</AppText>
        <Pressable testID="forgot-password-back" onPress={() => router.replace('/sign-in')}>
          <AppText style={{ color: colors.primary }}>
            {t('auth.forgotPassword.backToSignIn')}
          </AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      testID="forgot-password-screen"
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
        gap: spacing.md,
        justifyContent: 'center',
      }}
    >
      <AppText variant="muted">{t('auth.forgotPassword.body')}</AppText>
      <TextField
        testID="forgot-password-email"
        label={t('auth.forgotPassword.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      {error ? (
        <AppText testID="forgot-password-error" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
      <Button
        testID="forgot-password-submit"
        title={t('auth.forgotPassword.submit')}
        onPress={() => void onSubmit()}
        loading={submitting}
        disabled={!email}
      />
    </View>
  );
}
