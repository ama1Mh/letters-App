import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { contentTextAlign } from '@/core/i18n/direction';
import { useTheme } from '@/core/theme/useTheme';
import type { TextDirection } from '@/domain/bodyDirection';
import { inkOf, paperOf, resolveFont, stampOf, type Design } from '@/domain/design';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Letter text is read, not skimmed, so it sits above the UI's body size (fontSize.md = 16). */
export const LETTER_BODY_SIZE = 18;
export const LETTER_SUBJECT_SIZE = 22;
const LINE_HEIGHT_RATIO = 1.6;

/**
 * Per-font optical correction, keyed by catalog font key. Handwriting faces such as Caveat have a
 * much smaller x-height than the UI font, so at the same point size they read ~25% smaller, and
 * the gap was obvious at large system font scales (QA 2026-10-01). Sizes stay plain numbers, so
 * React Native still multiplies them (and the line height) by the user's font scale.
 */
const OPTICAL_SCALE: Readonly<Record<string, number>> = { caveat: 1.3, amiri: 1.1 };

export function letterTextSize(
  fontKey: string,
  base: number,
): {
  fontSize: number;
  lineHeight: number;
} {
  const fontSize = Math.round(base * (OPTICAL_SCALE[fontKey] ?? 1));
  return { fontSize, lineHeight: Math.round(fontSize * LINE_HEIGHT_RATIO) };
}

export interface LetterRendererProps {
  design: Design;
  subject?: string | null;
  body: string;
  /** The letter's own direction (PLAN §3.5), independent of the viewer's UI language. */
  bodyDir: TextDirection;
  testID?: string;
}

/**
 * Renders a letter exactly as its design and `bodyDir` dictate - never the viewer's own UI
 * direction (DEC-014). This is the one renderer for both the design picker's live preview and the
 * compose screen's live preview; there is no separate reading view yet (Phase 6+), so PLAN's Phase
 * 4 exit criterion ("same letter renders identically in preview and reading view") holds simply
 * because both today's callers, and a future reading view, share this exact component.
 *
 * Text alignment/`writingDirection` are driven by `bodyDir`, not the UI's - `Text` does not
 * auto-detect content direction the way `TextInput` does (OPEN-4 spike finding; same pattern
 * already used for the drafts list row preview). Everything else (the stamp's corner) is ordinary
 * UI layout and uses the logical `end`, unrelated to the letter's own direction.
 */
export function LetterRenderer({ design, subject, body, bodyDir, testID }: LetterRendererProps) {
  const { spacing, radius } = useTheme();
  const paper = paperOf(design);
  const ink = inkOf(design);
  const font = resolveFont(design, bodyDir);
  const stamp = stampOf(design);
  const textAlign = contentTextAlign(bodyDir);

  return (
    <View
      testID={testID}
      style={{
        backgroundColor: paper.color,
        borderRadius: radius.md,
        padding: spacing.lg,
        gap: spacing.sm,
        minHeight: 160,
      }}
    >
      {stamp ? (
        <View
          testID={testID ? `${testID}-stamp` : undefined}
          style={{ position: 'absolute', top: spacing.sm, end: spacing.sm }}
        >
          <Ionicons name={stamp.icon as IconName} size={22} color={ink.color} />
        </View>
      ) : null}
      {subject ? (
        <AppText
          testID={testID ? `${testID}-subject` : undefined}
          style={{
            fontFamily: font.family,
            color: ink.color,
            ...letterTextSize(font.key, LETTER_SUBJECT_SIZE),
            fontWeight: '600',
            textAlign,
            writingDirection: bodyDir,
          }}
        >
          {subject}
        </AppText>
      ) : null}
      <AppText
        testID={testID ? `${testID}-body` : undefined}
        style={{
          fontFamily: font.family,
          color: ink.color,
          ...letterTextSize(font.key, LETTER_BODY_SIZE),
          textAlign,
          writingDirection: bodyDir,
        }}
      >
        {body}
      </AppText>
    </View>
  );
}
