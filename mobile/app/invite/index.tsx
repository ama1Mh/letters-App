import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Share, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { currentBrand } from '@/core/config/brand';
import { knownErrorKey } from '@/core/i18n/errorKey';
import { useTheme } from '@/core/theme/useTheme';
import {
  DiscoveryActionError,
  getDiscoveryRepository,
  type Invite,
} from '@/data/discovery/discoveryRepository';

const REDEEM_CODES = ['invite_not_found', 'invalid_input', 'rate_limited'] as const;

/** "My invite" screen (DEC-012): one active invite per owner, get-or-created lazily, with a
 *  regenerate action, plus a manual "enter a code" field for a code read aloud rather than tapped
 *  as a deep link (the deep-link target itself is invite/[code].tsx). */
export default function MyInviteScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState(false);

  const [attempt, setAttempt] = useState(0);

  // Re-runs on Retry (attempt + 1). An async IIFE, not a direct call, the same as
  // AuthProvider.tsx's mount effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    void (async () => {
      try {
        setInvite(await getDiscoveryRepository().getOrCreateInvite());
      } catch {
        setLoadFailed(true);
      }
    })();
  }, [attempt]);

  function retry() {
    setLoadFailed(false);
    setAttempt((count) => count + 1);
  }

  const link = invite ? `${currentBrand().scheme}://invite/${invite.code}` : null;

  async function onShare() {
    if (!link) return;
    await Share.share({ message: link });
  }

  async function onRegenerate() {
    setRegenerating(true);
    try {
      setInvite(await getDiscoveryRepository().regenerateInvite());
    } catch {
      setLoadFailed(true);
    } finally {
      setRegenerating(false);
    }
  }

  async function onRedeem() {
    setError(null);
    setRedeemed(false);
    setRedeeming(true);
    try {
      await getDiscoveryRepository().redeemInvite(code.trim());
      setCode('');
      setRedeemed(true);
    } catch (e) {
      const errCode = e instanceof DiscoveryActionError ? e.code : 'unknown';
      setError(t(`invite.error.${knownErrorKey(errCode, REDEEM_CODES)}`));
    } finally {
      setRedeeming(false);
    }
  }

  // The header already says "My invite" (app/_layout.tsx), so the body has no second title.
  return (
    <ScrollView
      testID="my-invite-screen"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      keyboardShouldPersistTaps="handled"
    >
      {link ? (
        <>
          <TextField
            testID="my-invite-link"
            label={t('invite.linkLabel')}
            value={link}
            editable={false}
            // Wraps instead of scrolling, so the whole link stays readable at large font sizes.
            multiline
          />
          <AppText variant="muted">{t('invite.linkHint')}</AppText>
        </>
      ) : loadFailed ? (
        <View style={{ gap: spacing.sm }}>
          <AppText testID="my-invite-load-error" style={{ color: colors.danger }}>
            {t('invite.loadError')}
          </AppText>
          <Button testID="my-invite-retry" title={t('invite.retry')} onPress={retry} />
        </View>
      ) : (
        <ActivityIndicator testID="my-invite-loading" accessibilityLabel={t('invite.linkLabel')} />
      )}
      <Button
        testID="my-invite-share"
        title={t('invite.shareButton')}
        onPress={() => void onShare()}
        disabled={!link}
      />
      <Button
        testID="my-invite-regenerate"
        title={t('invite.regenerateButton')}
        variant="secondary"
        loading={regenerating}
        onPress={() => void onRegenerate()}
        disabled={!invite}
      />

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <TextField
          testID="my-invite-enter-code"
          label={t('invite.enterCodeLabel')}
          placeholder={t('invite.enterCodePlaceholder')}
          value={code}
          onChangeText={(next) => setCode(next.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {error ? (
          <AppText
            testID="my-invite-enter-code-error"
            accessibilityLiveRegion="polite"
            style={{ color: colors.danger }}
          >
            {error}
          </AppText>
        ) : null}
        {redeemed ? (
          <AppText testID="my-invite-redeemed" accessibilityLiveRegion="polite">
            {t('invite.redeemedTitle')} {t('invite.redeemedBody')}
          </AppText>
        ) : null}
        <Button
          testID="my-invite-enter-code-submit"
          title={t('invite.enterCodeButton')}
          variant="secondary"
          loading={redeeming}
          disabled={!code.trim()}
          onPress={() => void onRedeem()}
        />
      </View>
    </ScrollView>
  );
}
