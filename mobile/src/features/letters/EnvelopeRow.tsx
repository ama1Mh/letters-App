import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { currentLanguage } from '@/core/i18n';
import { formatDate } from '@/core/i18n/format';
import { useTheme } from '@/core/theme/useTheme';
import type { Correspondent } from '@/data/letters/lettersRepository';
import { avatarSourceFromKey } from '@/domain/avatar';

const STAMP_W = 46;
const STAMP_H = 54;
const POSTMARK = 52;

export interface EnvelopeRowProps {
  testID: string;
  onPress: () => void;
  accessibilityHint?: string;
  /** Shown inside the perforated stamp frame; omitted = an empty frame (a draft with no recipient). */
  person?: Correspondent | null;
  /** The postmark's date; omitted = no postmark (an unsent draft). */
  date?: Date | null;
  /** Unread: a burgundy wax dot under the postmark; the dot carries this testID. */
  unreadTestID?: string;
  children: ReactNode;
}

/**
 * A letter in a list, drawn as an envelope (Phase 13, DEC-063): ivory card, a perforated stamp
 * frame holding the correspondent's avatar, a round postmark with the day and month, and a wax
 * seal dot when unread. The row's own content (name, subject, preview, status) is passed in, so
 * each list keeps its text, testIDs and accessibility hints. Decorations are hidden from TalkBack.
 */
export function EnvelopeRow({
  testID,
  onPress,
  accessibilityHint,
  person,
  date,
  unreadTestID,
  children,
}: EnvelopeRowProps) {
  const { colors, spacing, fonts } = useTheme();
  const language = currentLanguage();
  const day = date ? formatDate(date, language, { day: 'numeric' }) : null;
  const month = date ? formatDate(date, language, { month: 'short' }) : null;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => ({
        marginHorizontal: spacing.lg,
        marginTop: spacing.sm,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 4,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{
          width: STAMP_W,
          height: STAMP_H,
          padding: 3,
          borderWidth: 2,
          borderStyle: 'dotted',
          borderColor: colors.border,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {person ? (
          <Avatar source={avatarSourceFromKey(person.avatarKey)} size={STAMP_W - 14} />
        ) : null}
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>{children}</View>

      {day ? (
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          {/* The postmark is decoration; unread is announced by the row's hint, the dot shows it. */}
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={{
              width: POSTMARK,
              height: POSTMARK,
              borderRadius: POSTMARK / 2,
              borderWidth: 1.5,
              borderColor: colors.textMuted,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.85,
            }}
          >
            <AppText
              allowFontScaling={false}
              style={{
                fontFamily: fonts.display,
                fontSize: 16,
                lineHeight: 18,
                color: colors.textMuted,
              }}
            >
              {day}
            </AppText>
            <AppText
              allowFontScaling={false}
              numberOfLines={1}
              style={{
                fontSize: 10,
                lineHeight: 12,
                color: colors.textMuted,
                letterSpacing: language === 'en' ? 0.8 : 0,
                textTransform: language === 'en' ? 'uppercase' : 'none',
              }}
            >
              {month}
            </AppText>
          </View>
          {unreadTestID ? (
            <View
              testID={unreadTestID}
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }}
            />
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
