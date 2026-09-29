import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { useTheme } from '@/core/theme/useTheme';
import { AVATAR_PRESETS } from '@/domain/avatar';
import { useAuth } from '@/features/auth/AuthProvider';

/** Internal id (test id / busy marker) of the "no avatar" option; never shown. */
const NO_AVATAR_ID = 'none';

/**
 * Choose a preset avatar (DEC-011: preset icons only in the MVP, no uploads). Saves on tap; the
 * database validates the key against the same catalog. "No avatar" clears it.
 */
export default function AvatarScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const { profile, repository, refresh } = useAuth();
  const [saving, setSaving] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const current = profile?.avatarKey ?? null;

  async function choose(key: string | null) {
    setSaving(key ?? NO_AVATAR_ID);
    setFailed(false);
    try {
      await repository.updateAvatar(key);
      await refresh();
    } catch {
      setFailed(true);
    } finally {
      setSaving(null);
    }
  }

  const options: (string | null)[] = [null, ...AVATAR_PRESETS.map((preset) => preset.key)];

  return (
    <ScrollView
      testID="avatar-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
    >
      {failed ? (
        <AppText testID="avatar-error" style={{ color: colors.danger }}>
          {t('letters.error.unknown')}
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {options.map((key, index) => {
          const selected = key === current;
          const id = key ?? NO_AVATAR_ID;
          return (
            <Pressable
              key={id}
              testID={`avatar-option-${id}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, busy: saving === id }}
              accessibilityLabel={key ? t('avatar.option', { number: index }) : t('avatar.none')}
              disabled={saving !== null}
              onPress={() => void choose(key)}
              style={{
                padding: spacing.xs,
                borderRadius: radius.lg,
                borderWidth: 2,
                borderColor: selected ? colors.primary : 'transparent',
              }}
            >
              <Avatar source={key ? { type: 'preset', key } : null} size={56} />
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
