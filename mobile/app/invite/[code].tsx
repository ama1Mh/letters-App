import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { knownErrorKey } from '@/core/i18n/errorKey';
import { useTheme } from '@/core/theme/useTheme';
import { DiscoveryActionError, getDiscoveryRepository } from '@/data/discovery/discoveryRepository';

const REDEEM_CODES = ['invite_not_found', 'invalid_input', 'rate_limited'] as const;

/** Deep-link target for `<scheme>://invite/<code>` (DEC-012). Redeems immediately on open - there
 *  is nothing for the tapper to review first, the invite link carries no information beyond the
 *  code itself (PLAN's push-payload-style minimalism). */
export default function RedeemInviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const [status, setStatus] = useState<'redeeming' | 'done' | 'error'>('redeeming');
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getDiscoveryRepository()
      .redeemInvite(code)
      .then(() => {
        if (!cancelled) setStatus('done');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const errCode = e instanceof DiscoveryActionError ? e.code : 'unknown';
        setErrorText(t(`invite.error.${knownErrorKey(errCode, REDEEM_CODES)}`));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [code, t]);

  return (
    <View
      testID="redeem-invite-screen"
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
        gap: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {status === 'redeeming' ? (
        <AppText testID="redeem-invite-loading">{t('invite.redeeming')}</AppText>
      ) : null}
      {status === 'done' ? (
        <>
          <AppText variant="title" testID="redeem-invite-success-title">
            {t('invite.redeemedTitle')}
          </AppText>
          <AppText style={{ textAlign: 'center' }}>{t('invite.redeemedBody')}</AppText>
          <Button
            testID="redeem-invite-back-to-inbox"
            title={t('invite.backToInbox')}
            onPress={() => router.replace('/(tabs)/inbox')}
          />
        </>
      ) : null}
      {status === 'error' ? (
        <>
          <AppText variant="title" testID="redeem-invite-error-title">
            {t('invite.errorTitle')}
          </AppText>
          {errorText ? <AppText style={{ textAlign: 'center' }}>{errorText}</AppText> : null}
          <Button
            testID="redeem-invite-error-back"
            title={t('invite.backToInbox')}
            onPress={() => router.replace('/(tabs)/inbox')}
          />
        </>
      ) : null}
    </View>
  );
}
