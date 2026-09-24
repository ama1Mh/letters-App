import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, View } from 'react-native';

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
  const [regenerating, setRegenerating] = useState(false);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getDiscoveryRepository().getOrCreateInvite().then(setInvite);
  }, []);

  const link = invite ? `${currentBrand().scheme}://invite/${invite.code}` : null;

  async function onShare() {
    if (!link) return;
    await Share.share({ message: link });
  }

  async function onRegenerate() {
    setRegenerating(true);
    try {
      setInvite(await getDiscoveryRepository().regenerateInvite());
    } finally {
      setRegenerating(false);
    }
  }

  async function onRedeem() {
    setError(null);
    setRedeeming(true);
    try {
      await getDiscoveryRepository().redeemInvite(code.trim());
      setCode('');
    } catch (e) {
      const errCode = e instanceof DiscoveryActionError ? e.code : 'unknown';
      setError(t(`invite.error.${knownErrorKey(errCode, REDEEM_CODES)}`));
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <View
      testID="my-invite-screen"
      style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md }}
    >
      <AppText variant="title">{t('invite.title')}</AppText>
      {link ? (
        <TextField
          testID="my-invite-link"
          label={t('invite.title')}
          value={link}
          editable={false}
        />
      ) : null}
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
          <AppText testID="my-invite-enter-code-error" style={{ color: colors.danger }}>
            {error}
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
    </View>
  );
}
