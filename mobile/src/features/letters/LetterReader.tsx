import { Ionicons } from '@expo/vector-icons';
import Storage from 'expo-sqlite/kv-store';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/AppText';
import { contentTextAlign } from '@/core/i18n/direction';
import { MIN_TOUCH_TARGET } from '@/core/theme/tokens';
import { useTheme } from '@/core/theme/useTheme';
import type { TextDirection } from '@/domain/bodyDirection';
import { elementEntry, paintOrder, type Design } from '@/domain/design';
import { LetterCanvas, postmarkDateText } from '@/features/designs/LetterCanvas';

const MODE_KEY = 'reader.mode';
const ZOOMS = [1, 1.5, 2] as const;

type Mode = 'designed' | 'plain';

function getStoredMode(): Mode {
  try {
    return Storage.getItemSync(MODE_KEY) === 'plain' ? 'plain' : 'designed';
  } catch {
    return 'designed';
  }
}

function storeMode(mode: Mode) {
  try {
    Storage.setItemSync(MODE_KEY, mode);
  } catch {
    // A per-device convenience only.
  }
}

export interface LetterReaderProps {
  design: Design;
  subject: string | null;
  body: string;
  bodyDir: TextDirection;
  postmarkDate: Date;
  testID: string;
}

/**
 * The reading view's letter (DEC-061 (1)): the designed sheet with zoom, or "Read as plain text",
 * which shows the same structured text with the system font scale and normal screen-reader
 * behaviour, plus the decorations as words. The choice is remembered on this device.
 */
export function LetterReader({
  design,
  subject,
  body,
  bodyDir,
  postmarkDate,
  testID,
}: LetterReaderProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [mode, setModeState] = useState<Mode>(getStoredMode);
  const [zoom, setZoom] = useState(0);
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? Math.max(1, window.width - 2 * spacing.lg);

  function setMode(next: Mode) {
    setModeState(next);
    storeMode(next);
  }

  const decorations = paintOrder(design.elements)
    .filter((el) => elementEntry(el.type, el.asset))
    .map((el) => {
      const name = t(`design.elementNames.${el.asset}` as 'design.elementNames.stamp_dove');
      return elementEntry(el.type, el.asset)?.dated
        ? `${name} (${postmarkDateText(postmarkDate, bodyDir)})`
        : name;
    });

  return (
    <View style={{ gap: spacing.sm }} onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          testID={`${testID}-mode`}
          accessibilityRole="button"
          onPress={() => setMode(mode === 'plain' ? 'designed' : 'plain')}
          style={{ minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', flexShrink: 1 }}
        >
          <AppText style={{ color: colors.primary }}>
            {mode === 'plain' ? t('letter.readDesigned') : t('letter.readPlain')}
          </AppText>
        </Pressable>
        {mode === 'designed' ? (
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginStart: 'auto' }}>
            <ZoomButton
              testID={`${testID}-zoom-out`}
              icon="remove"
              label={t('letter.zoomOut')}
              disabled={zoom === 0}
              onPress={() => setZoom((z) => Math.max(0, z - 1))}
            />
            <ZoomButton
              testID={`${testID}-zoom-in`}
              icon="add"
              label={t('letter.zoomIn')}
              disabled={zoom === ZOOMS.length - 1}
              onPress={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
            />
          </View>
        ) : null}
      </View>

      {mode === 'plain' ? (
        <View testID={`${testID}-plain`} style={{ gap: spacing.sm }}>
          {subject ? (
            <AppText
              variant="title"
              style={{ textAlign: contentTextAlign(bodyDir), writingDirection: bodyDir }}
            >
              {subject}
            </AppText>
          ) : null}
          <AppText style={{ textAlign: contentTextAlign(bodyDir), writingDirection: bodyDir }}>
            {body}
          </AppText>
          {decorations.length > 0 ? (
            <AppText variant="muted">
              {t('letter.decorations', { list: decorations.join(`${t('letter.listSeparator')} `) })}
            </AppText>
          ) : null}
        </View>
      ) : (
        <ScrollView
          horizontal
          scrollEnabled={zoom > 0}
          showsHorizontalScrollIndicator={zoom > 0}
          // The sheet is physical: a zoomed letter opens at its left edge in both UI directions
          // (an RTL ScrollView would start at the right, mid-line; device check 12.4).
          style={{ direction: 'ltr' }}
        >
          <LetterCanvas
            testID={testID}
            design={design}
            subject={subject}
            body={body}
            bodyDir={bodyDir}
            postmarkDate={postmarkDate}
            width={width * ZOOMS[zoom]}
          />
        </ScrollView>
      )}
    </View>
  );
}

function ZoomButton({
  testID,
  icon,
  label,
  disabled,
  onPress,
}: {
  testID: string;
  icon: 'remove' | 'add';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}
