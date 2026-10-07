import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { ltrIsolate } from '@/core/i18n/bidi';
import { useTheme } from '@/core/theme/useTheme';
import type { Correspondent } from '@/data/letters/lettersRepository';
import { avatarSourceFromKey } from '@/domain/avatar';

const AVATAR_SIZE = 32;

/**
 * The other person on a letter: their avatar (DEC-011), then the display name with `@username`
 * always beside it (CLAUDE.md, look-alike protection), the username LTR-isolated so it reads
 * correctly inside RTL UI. A deleted account (no profile fields) shows one neutral label.
 */
export function CorrespondentName({
  person,
  prefix,
  testID,
  hideAvatar = false,
}: {
  person: Correspondent;
  /** In an envelope row the stamp frame already shows the avatar. */
  hideAvatar?: boolean;
  /** Optional translated lead-in such as "To", shown before the name. */
  prefix?: string;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  if (!person.username) {
    return (
      <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {hideAvatar ? null : <Avatar source={null} size={AVATAR_SIZE} />}
        <AppText variant="title" style={{ flexShrink: 1 }}>
          {prefix ? `${prefix} ` : ''}
          {t('letters.deletedAccount')}
        </AppText>
      </View>
    );
  }

  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      {hideAvatar ? null : (
        <Avatar
          testID={testID ? `${testID}-avatar` : undefined}
          source={avatarSourceFromKey(person.avatarKey)}
          size={AVATAR_SIZE}
        />
      )}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: spacing.xs,
          flexShrink: 1,
        }}
      >
        <AppText variant="title">
          {prefix ? `${prefix} ` : ''}
          {person.displayName ?? ''}
        </AppText>
        <AppText variant="muted">{ltrIsolate(`@${person.username}`)}</AppText>
      </View>
    </View>
  );
}
