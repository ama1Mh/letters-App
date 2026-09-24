import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { currentLanguage } from '@/core/i18n';
import { useTheme } from '@/core/theme/useTheme';
import { AuthActionError, type SignUpErrorCode } from '@/data/supabase/auth';
import { useAuth } from '@/features/auth/AuthProvider';

const KNOWN_CODES: readonly SignUpErrorCode[] = [
  'user_already_exists',
  'weak_password',
  'email_address_invalid',
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'signup_disabled',
  'email_provider_disabled',
];

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const auth = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const trimmed = email.trim();
      const { needsEmailConfirmation } = await auth.repository.signUpWithPassword({
        email: trimmed,
        password,
        locale: currentLanguage(),
      });
      if (needsEmailConfirmation) {
        setConfirmationSentTo(trimmed);
      } else {
        // Confirmations disabled (not the DEC-038 default, but handle it): a session came back
        // already, so go straight through the gate to onboarding.
        await auth.refresh();
        router.replace('/');
      }
    } catch (e) {
      const code = e instanceof AuthActionError ? (e.code as SignUpErrorCode) : 'unknown';
      setError(t(`auth.signUp.error.${KNOWN_CODES.includes(code) ? code : 'unknown'}`));
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmationSentTo) {
    return (
      <View
        testID="sign-up-confirmation"
        style={{
          flex: 1,
          backgroundColor: colors.background,
          padding: spacing.lg,
          gap: spacing.sm,
          justifyContent: 'center',
        }}
      >
        <AppText variant="title">{t('auth.signUp.confirmationTitle')}</AppText>
        <AppText>{t('auth.signUp.confirmationBody', { email: confirmationSentTo })}</AppText>
        <Pressable testID="sign-up-confirmation-back" onPress={() => router.replace('/sign-in')}>
          <AppText style={{ color: colors.primary }}>{t('auth.signIn.title')}</AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      testID="sign-up-screen"
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
        gap: spacing.md,
        justifyContent: 'center',
      }}
    >
      <TextField
        testID="sign-up-email"
        label={t('auth.signUp.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        testID="sign-up-password"
        label={t('auth.signUp.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {error ? (
        <AppText testID="sign-up-error" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
      <Button
        testID="sign-up-submit"
        title={t('auth.signUp.submit')}
        onPress={() => void onSubmit()}
        loading={submitting}
        disabled={!email || !password}
      />
      <View style={{ flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
        <AppText variant="muted">{t('auth.signUp.hasAccount')}</AppText>
        <Pressable testID="sign-up-go-sign-in" onPress={() => router.push('/sign-in')}>
          <AppText style={{ color: colors.primary }}>{t('auth.signUp.signInLink')}</AppText>
        </Pressable>
      </View>
    </View>
  );
}
