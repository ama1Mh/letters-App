import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { formatDate } from '@/core/i18n/format';
import type { TextDirection } from '@/domain/bodyDirection';
import {
  elementEntry,
  inkOf,
  paintOrder,
  paperOf,
  resolveFont,
  textSizeOf,
  type Design,
  type DesignElement,
} from '@/domain/design';

import { EDGE_AGEING, ELEMENT_IMAGES, PAPER_TEXTURES } from './designAssets';

/**
 * The letter as a physical sheet (DEC-060/062). Everything inside is laid out at a FIXED logical
 * width of 360 dp, then the whole sheet is scaled uniformly to the space it gets. The 12.0 spike
 * showed this is what keeps line breaks identical across phones (sizing text proportionally to the
 * screen did not), so sender and recipient see the same composition. Text inside the sheet ignores
 * the system font scale for the same reason; the reading view offers zoom and a plain-text mode that
 * follows it (DEC-061 (1)).
 *
 * The sheet is a physical object: its coordinate space is left-to-right in both UI directions
 * (`direction: 'ltr'` on the frame), and element positions are fractions of the sheet width from the
 * physical top-left. Only the text follows the letter's own `bodyDir`.
 */
export const CANVAS_WIDTH = 360;
export const CANVAS_PADDING = 28;
/** A sheet is at least A-paper proportioned. */
export const CANVAS_MIN_ASPECT = 1.414;
const LINE_HEIGHT_RATIO = 1.6;
export const LETTER_SUBJECT_SIZE = 22;

/**
 * Per-font optical correction, keyed by catalog font key: handwriting faces such as Caveat have a
 * much smaller x-height than the UI font, so at the same size they read ~25% smaller.
 */
const OPTICAL_SCALE: Readonly<Record<string, number>> = {
  caveat: 1.3,
  amiri: 1.1,
  im_fell_english: 1.08,
};

export function letterTextSize(
  fontKey: string,
  base: number,
): { fontSize: number; lineHeight: number } {
  const fontSize = Math.round(base * (OPTICAL_SCALE[fontKey] ?? 1));
  return { fontSize, lineHeight: Math.round(fontSize * LINE_HEIGHT_RATIO) };
}

/** Element size in logical units (scale applied to the width, so artwork is drawn, not stretched). */
export function elementBox(el: DesignElement): { width: number; height: number } {
  const entry = elementEntry(el.type, el.asset);
  const width = (entry?.width ?? 0.2) * CANVAS_WIDTH * el.scale;
  return { width, height: width * (entry?.aspect ?? 1) };
}

/** How far down the sheet an element reaches (its rotated bounding circle, to stay simple). */
function elementBottom(el: DesignElement): number {
  const { width, height } = elementBox(el);
  return el.y * CANVAS_WIDTH + Math.hypot(width, height) / 2;
}

export function sheetHeight(textHeight: number, elements: readonly DesignElement[]): number {
  let height = Math.max(CANVAS_WIDTH * CANVAS_MIN_ASPECT, textHeight + 2 * CANVAS_PADDING);
  for (const el of elements) height = Math.max(height, elementBottom(el) + 8);
  return Math.ceil(height);
}

/** Paper tiles are `name@3x.webp`, 512 px, so each covers 512 / 3 dp of the logical sheet. */
export const PAPER_TILE = 512 / 3;

/**
 * The paper texture, tiled explicitly: `resizeMode="repeat"` drew a single tile on the Android
 * emulator (12.4 device check). The tiles are seamless, so a plain grid looks continuous.
 */
function PaperTiles({ paperKey, logicalHeight }: { paperKey: string; logicalHeight: number }) {
  const cols = Math.ceil(CANVAS_WIDTH / PAPER_TILE);
  const rows = Math.ceil(logicalHeight / PAPER_TILE);
  const tiles: ReactNode[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      tiles.push(
        <Image
          key={`${r}-${c}`}
          source={PAPER_TEXTURES[paperKey]}
          accessible={false}
          importantForAccessibility="no"
          style={{
            position: 'absolute',
            top: r * PAPER_TILE,
            start: c * PAPER_TILE,
            // +1: the tile size is fractional, so scaled tiles would leave hairline seams.
            width: PAPER_TILE + 1,
            height: PAPER_TILE + 1,
          }}
        />,
      );
    }
  }
  return <>{tiles}</>;
}

/** Lays the sheet out at 360 dp and scales it to `width`; children use logical coordinates. */
export function CanvasFrame({
  design,
  width,
  logicalHeight,
  testID,
  children,
}: {
  design: Design;
  width: number;
  logicalHeight: number;
  testID?: string;
  children: ReactNode;
}) {
  const paper = paperOf(design);
  const scale = width / CANVAS_WIDTH;
  return (
    <View
      testID={testID}
      style={{
        width,
        height: logicalHeight * scale,
        overflow: 'hidden',
        direction: 'ltr',
        backgroundColor: paper.color,
        borderRadius: 4,
      }}
    >
      <View
        style={{
          width: CANVAS_WIDTH,
          height: logicalHeight,
          transformOrigin: '0 0',
          transform: [{ scale }],
        }}
      >
        <PaperTiles paperKey={paper.key} logicalHeight={logicalHeight} />
        <Image
          source={EDGE_AGEING}
          resizeMode="stretch"
          style={StyleSheet.absoluteFill}
          accessible={false}
          importantForAccessibility="no"
        />
        {children}
      </View>
    </View>
  );
}

export function canvasTextStyles(design: Design, bodyDir: TextDirection) {
  const font = resolveFont(design, bodyDir);
  const color = inkOf(design).color;
  // Physical, not contentTextAlign(): Android swaps left/right only for nodes laid out RTL, and the
  // sheet is always laid out LTR, so here 'left' means left in both UI directions (12.0 spike).
  const textAlign = bodyDir === 'rtl' ? ('right' as const) : ('left' as const);
  return {
    subject: {
      fontFamily: font.family,
      color,
      ...letterTextSize(font.key, LETTER_SUBJECT_SIZE),
      textAlign,
      writingDirection: bodyDir,
    },
    body: {
      fontFamily: font.family,
      color,
      ...letterTextSize(font.key, textSizeOf(design)),
      textAlign,
      writingDirection: bodyDir,
    },
  } as const;
}

/** The letter's language for anything the sheet itself writes (postmark dates): follows bodyDir. */
function sheetLanguage(bodyDir: TextDirection): 'ar' | 'en' {
  return bodyDir === 'rtl' ? 'ar' : 'en';
}

export function postmarkDateText(date: Date, bodyDir: TextDirection): string {
  const language = sheetLanguage(bodyDir);
  const text = formatDate(date, language, { day: 'numeric', month: 'short', year: 'numeric' });
  return language === 'en' ? text.toUpperCase() : text;
}

/** One placed element, static. `children` lets the editor add a selection outline. */
export function ElementImage({
  el,
  bodyDir,
  postmarkDate,
  testID,
  children,
}: {
  el: DesignElement;
  bodyDir: TextDirection;
  postmarkDate: Date;
  testID?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const entry = elementEntry(el.type, el.asset);
  const { width, height } = elementBox(el);
  const dateText = entry?.dated ? postmarkDateText(postmarkDate, bodyDir) : null;
  const name = t(`design.elementNames.${el.asset}` as 'design.elementNames.stamp_dove');
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={dateText ? `${name}, ${dateText}` : name}
      style={{
        position: 'absolute',
        top: 0,
        start: 0,
        width,
        height,
        transform: [
          { translateX: el.x * CANVAS_WIDTH - width / 2 },
          { translateY: el.y * CANVAS_WIDTH - height / 2 },
          { rotate: `${el.rotation}deg` },
        ],
      }}
    >
      <Image source={ELEMENT_IMAGES[el.asset]} resizeMode="contain" style={{ width, height }} />
      {dateText ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              fontFamily: bodyDir === 'rtl' ? 'Amiri_400Regular' : 'IMFellEnglish_400Regular',
              fontSize: width * 0.105,
              color: 'rgba(40, 45, 70, 0.85)',
              writingDirection: bodyDir,
            }}
          >
            {dateText}
          </Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

export interface LetterCanvasProps {
  design: Design;
  subject?: string | null;
  body: string;
  /** The letter's own direction (DEC-014), independent of the viewer's UI language. */
  bodyDir: TextDirection;
  /** The letter's date for dated postmarks (delivered, else scheduled, else today). */
  postmarkDate?: Date;
  /** Display width; when omitted the sheet fills its container's width. */
  width?: number;
  testID?: string;
}

/** Read-only sheet: reading view, previews. */
export function LetterCanvas({
  design,
  subject,
  body,
  bodyDir,
  postmarkDate,
  width,
  testID,
}: LetterCanvasProps) {
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const [textHeight, setTextHeight] = useState(0);
  const displayWidth = width ?? measured ?? Math.max(1, window.width - 32);
  const styles = canvasTextStyles(design, bodyDir);
  const date = postmarkDate ?? new Date();

  return (
    <View
      onLayout={width ? undefined : (e) => setMeasured(e.nativeEvent.layout.width)}
      style={{ alignSelf: 'stretch' }}
    >
      <CanvasFrame
        testID={testID}
        design={design}
        width={displayWidth}
        logicalHeight={sheetHeight(textHeight, design.elements)}
      >
        <View
          onLayout={(e) => setTextHeight(e.nativeEvent.layout.height)}
          style={{ padding: CANVAS_PADDING, gap: 8 }}
        >
          {subject ? (
            <Text
              testID={testID ? `${testID}-subject` : undefined}
              allowFontScaling={false}
              style={[styles.subject, { fontWeight: '600' }]}
            >
              {subject}
            </Text>
          ) : null}
          <Text
            testID={testID ? `${testID}-body` : undefined}
            allowFontScaling={false}
            style={styles.body}
          >
            {body}
          </Text>
        </View>
        {paintOrder(design.elements).map((el) => (
          <ElementImage
            key={el.id}
            testID={testID ? `${testID}-element-${el.id}` : undefined}
            el={el}
            bodyDir={bodyDir}
            postmarkDate={date}
          />
        ))}
      </CanvasFrame>
    </View>
  );
}
