import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/core/theme/useTheme';
import { AuthActionError, type SignInErrorCode } from '@/data/supabase/auth';
import { useAuth } from '@/features/auth/AuthProvider';

const KNOWN_CODES: readonly SignInErrorCode[] = [
  'invalid_credentials',
  'email_not_confirmed',
  'over_request_rate_limit',
];

export default function SignInScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const auth = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await auth.repository.signInWithPassword({ email: email.trim(), password });
      await auth.refresh();
      router.replace('/'); // back through the gate: lands on onboarding or the tab shell
    } catch (e) {
      const code = e instanceof AuthActionError ? (e.code as SignInErrorCode) : 'unknown';
      setError(t(`auth.signIn.error.${KNOWN_CODES.includes(code) ? code : 'unknown'}`));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View
      testID="sign-in-screen"
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
        gap: spacing.md,
        justifyContent: 'center',
      }}
    >
      <AppText variant="title">{t('auth.signIn.title')}</AppText>
      <TextField
        testID="sign-in-email"
        label={t('auth.signIn.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        testID="sign-in-password"
        label={t('auth.signIn.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        textContentType="password"
      />
      {error ? (
        <AppText testID="sign-in-error" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
      <Button
        testID="sign-in-submit"
        title={t('auth.signIn.submit')}
        onPress={() => void onSubmit()}
        loading={submitting}
        disabled={!email || !password}
      />
      <Pressable testID="sign-in-forgot-password" onPress={() => router.push('/forgot-password')}>
        <AppText variant="muted" style={{ textAlign: 'center' }}>
          {t('auth.signIn.forgotPasswordLink')}
        </AppText>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
        <AppText variant="muted">{t('auth.signIn.noAccount')}</AppText>
        <Pressable testID="sign-in-go-sign-up" onPress={() => router.push('/sign-up')}>
          <AppText style={{ color: colors.primary }}>{t('auth.signIn.signUpLink')}</AppText>
        </Pressable>
      </View>
    </View>
  );
}
