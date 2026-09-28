import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ltrIsolate } from '@/core/i18n/bidi';
import { useTheme } from '@/core/theme/useTheme';
import type { Correspondent } from '@/data/letters/lettersRepository';

/**
 * The other person on a letter: display name with `@username` always beside it (CLAUDE.md,
 * look-alike protection), the username LTR-isolated so it reads correctly inside RTL UI. A deleted
 * account (no profile fields) shows one neutral label.
 */
export function CorrespondentName({
  person,
  prefix,
  testID,
}: {
  person: Correspondent;
  /** Optional translated lead-in such as "To", shown before the name. */
  prefix?: string;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  if (!person.username) {
    return (
      <AppText testID={testID} variant="title">
        {prefix ? `${prefix} ` : ''}
        {t('letters.deletedAccount')}
      </AppText>
    );
  }

  return (
    <View
      testID={testID}
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.xs }}
    >
      <AppText variant="title">
        {prefix ? `${prefix} ` : ''}
        {person.displayName ?? ''}
      </AppText>
      <AppText variant="muted">{ltrIsolate(`@${person.username}`)}</AppText>
    </View>
  );
}
