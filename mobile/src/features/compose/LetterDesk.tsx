import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { MIN_TOUCH_TARGET } from '@/core/theme/tokens';
import { useTheme } from '@/core/theme/useTheme';
import type { TextDirection } from '@/domain/bodyDirection';
import {
  DESIGN_CATALOG,
  DESIGN_LIMITS,
  ELEMENT_TYPES,
  addElement,
  canAddElement,
  fontsForDirection,
  normalizeZ,
  paintOrder,
  removeElement,
  shiftLayer,
  updateElement,
  type Design,
  type DesignElement,
  type ElementType,
} from '@/domain/design';
import { LETTER_BODY_MAX, LETTER_SUBJECT_MAX } from '@/domain/letterLimits';
import { ELEMENT_IMAGES, PAPER_TEXTURES } from '@/features/designs/designAssets';
import {
  CANVAS_PADDING,
  CANVAS_WIDTH,
  CanvasFrame,
  ElementImage,
  canvasTextStyles,
  sheetHeight,
} from '@/features/designs/LetterCanvas';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type DeskMode = 'paper' | 'write' | 'decorate';
export const DESK_MODES: readonly DeskMode[] = ['paper', 'write', 'decorate'];

/** Button steps for the accessible manipulation controls (gestures come in a later step). */
const MOVE_STEP = 0.02;
const SCALE_STEP = 1.15;
const ROTATE_STEP = 15;
const UNDO_MS = 5000;

// ---------------------------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------------------------

export interface DeskSheetProps {
  design: Design;
  mode: DeskMode;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Tapping the letter's text outside Write mode switches to Write. */
  onWantWrite: () => void;
  subject: string;
  body: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  bodyDir: TextDirection;
  postmarkDate: Date;
  /** Reports the sheet's position in the scroll content and its display width. */
  onSheetLayout?: (layout: { y: number; width: number }) => void;
  testID: string;
}

/**
 * The letter being written: the same 360 dp sheet as the reading view (LetterCanvas), with the
 * subject and body typed directly on the paper in Write mode, and the decorations selectable in
 * Decorate mode. Decorations ignore touches outside Decorate mode so they never block the text.
 */
export function DeskSheet(props: DeskSheetProps) {
  const { t } = useTranslation();
  const { design, mode, bodyDir } = props;
  const [width, setWidth] = useState<number | null>(null);
  const [textHeight, setTextHeight] = useState(0);
  const styles = canvasTextStyles(design, bodyDir);
  const placeholderColor = `${styles.body.color}80`;

  return (
    <View
      onLayout={(e) => {
        const { y, width: w } = e.nativeEvent.layout;
        setWidth(w);
        props.onSheetLayout?.({ y, width: w });
      }}
      style={{ alignSelf: 'stretch' }}
    >
      <CanvasFrame
        testID={`${props.testID}-preview`}
        design={design}
        width={width ?? CANVAS_WIDTH}
        logicalHeight={sheetHeight(textHeight, design.elements)}
      >
        <View
          onLayout={(e) => setTextHeight(e.nativeEvent.layout.height)}
          style={{ padding: CANVAS_PADDING, gap: 8 }}
        >
          {mode === 'write' ? (
            <>
              <TextInput
                testID={`${props.testID}-subject`}
                accessibilityLabel={t('compose.subjectLabel')}
                placeholder={t('compose.subjectLabel')}
                placeholderTextColor={placeholderColor}
                value={props.subject}
                onChangeText={props.onSubjectChange}
                maxLength={LETTER_SUBJECT_MAX}
                allowFontScaling={false}
                style={[styles.subject, { fontWeight: '600', padding: 0 }]}
              />
              <TextInput
                testID={`${props.testID}-body`}
                accessibilityLabel={t('compose.bodyLabel')}
                placeholder={t('compose.bodyLabel')}
                placeholderTextColor={placeholderColor}
                value={props.body}
                onChangeText={props.onBodyChange}
                maxLength={LETTER_BODY_MAX}
                multiline
                scrollEnabled={false}
                allowFontScaling={false}
                // Android centres multiline text vertically by default (phone QA, 2026-10-01).
                style={[styles.body, { padding: 0, minHeight: 160, textAlignVertical: 'top' }]}
              />
            </>
          ) : (
            <Pressable
              testID={`${props.testID}-text`}
              accessibilityRole="button"
              accessibilityHint={t('desk.modes.write')}
              onPress={props.onWantWrite}
              style={{ gap: 8 }}
            >
              {props.subject ? (
                <Text allowFontScaling={false} style={[styles.subject, { fontWeight: '600' }]}>
                  {props.subject}
                </Text>
              ) : null}
              <Text
                allowFontScaling={false}
                style={[styles.body, { minHeight: 160, opacity: props.body ? 1 : 0.5 }]}
              >
                {props.body || t('compose.bodyLabel')}
              </Text>
            </Pressable>
          )}
        </View>
        <View
          pointerEvents={mode === 'decorate' ? 'box-none' : 'none'}
          style={{ position: 'absolute', top: 0, start: 0, width: CANVAS_WIDTH, height: '100%' }}
        >
          {paintOrder(design.elements).map((el) => (
            <ElementImage
              key={el.id}
              testID={`${props.testID}-element-${el.id}`}
              el={el}
              bodyDir={bodyDir}
              postmarkDate={props.postmarkDate}
              selected={mode === 'decorate' && el.id === props.selectedId}
              onPress={
                mode === 'decorate'
                  ? () => props.onSelect(el.id === props.selectedId ? null : el.id)
                  : undefined
              }
            />
          ))}
        </View>
      </CanvasFrame>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// The toolbar (sticky above the sheet)
// ---------------------------------------------------------------------------------------------

export interface DeskToolbarProps {
  design: Design;
  onDesignChange: (design: Design) => void;
  /** False when the stored design is newer than this app: the design is shown, never changed. */
  designEditable: boolean;
  mode: DeskMode;
  onModeChange: (mode: DeskMode) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  bodyDir: TextDirection;
  /** Vertical centre of what is on screen, in sheet-width units, for newly added decorations. */
  getVisibleCenterY: () => number;
  random?: () => number;
  testID: string;
}

export function DeskToolbar(props: DeskToolbarProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { design, mode, testID } = props;
  const [removed, setRemoved] = useState<DesignElement | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const selected = design.elements.find((el) => el.id === props.selectedId) ?? null;

  function change(next: Design) {
    if (props.designEditable) props.onDesignChange(next);
  }

  function onRemove(el: DesignElement) {
    change(removeElement(design, el.id));
    props.onSelect(null);
    setRemoved(el);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setRemoved(null), UNDO_MS);
  }

  function onUndo() {
    if (!removed || !canAddElement(design)) return;
    // Back where it was, on top of the stack it had (z is renumbered).
    change({
      ...design,
      elements: normalizeZ([...design.elements, { ...removed, z: removed.z - 0.5 }]),
    });
    props.onSelect(removed.id);
    setRemoved(null);
  }

  function onAdd(type: ElementType, asset: string) {
    const added = addElement(design, type, asset, {
      bodyDir: props.bodyDir,
      visibleCenterY: props.getVisibleCenterY(),
      random: props.random ?? Math.random,
    });
    if (!added) return;
    change(added.design);
    props.onSelect(added.id);
  }

  return (
    <View
      testID={`${testID}-toolbar`}
      style={{ backgroundColor: colors.background, gap: spacing.sm, paddingVertical: spacing.sm }}
    >
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: spacing.xs }}>
        {DESK_MODES.map((m) => (
          <Pressable
            key={m}
            testID={`${testID}-mode-${m}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m }}
            onPress={() => {
              props.onModeChange(m);
              if (m !== 'decorate') props.onSelect(null);
            }}
            style={{
              flex: 1,
              minHeight: MIN_TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
              borderBottomWidth: mode === m ? 3 : 1,
              borderBottomColor: mode === m ? colors.primary : colors.border,
            }}
          >
            <AppText style={{ color: mode === m ? colors.primary : colors.text }}>
              {t(`desk.modes.${m}`)}
            </AppText>
          </Pressable>
        ))}
      </View>

      {!props.designEditable && mode !== 'write' ? (
        <AppText testID={`${testID}-read-only`} variant="muted">
          {t('desk.readOnly')}
        </AppText>
      ) : null}

      {mode === 'paper' ? <PaperTray {...props} change={change} /> : null}
      {mode === 'write' ? <WriteTray {...props} change={change} /> : null}
      {mode === 'decorate' && props.designEditable ? (
        selected ? (
          <SelectionBar
            testID={testID}
            el={selected}
            onMove={(dx, dy) =>
              change(updateElement(design, selected.id, { x: selected.x + dx, y: selected.y + dy }))
            }
            onScale={(f) =>
              change(updateElement(design, selected.id, { scale: selected.scale * f }))
            }
            onRotate={(d) =>
              change(updateElement(design, selected.id, { rotation: selected.rotation + d }))
            }
            onLayer={(step) => change(shiftLayer(design, selected.id, step))}
            onRemove={() => onRemove(selected)}
            onDone={() => props.onSelect(null)}
          />
        ) : (
          <DecorateTray testID={testID} design={design} onAdd={onAdd} />
        )
      ) : null}

      {removed ? (
        <View
          testID={`${testID}-undo-bar`}
          accessibilityLiveRegion="polite"
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
        >
          <AppText style={{ flex: 1 }}>
            {t('desk.removed', {
              name: t(`design.elementNames.${removed.asset}` as 'design.elementNames.stamp_dove'),
            })}
          </AppText>
          <Pressable
            testID={`${testID}-undo`}
            accessibilityRole="button"
            onPress={onUndo}
            style={{
              minHeight: MIN_TOUCH_TARGET,
              minWidth: MIN_TOUCH_TARGET,
              justifyContent: 'center',
            }}
          >
            <AppText style={{ color: colors.primary }}>{t('desk.undo')}</AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

type TrayProps = DeskToolbarProps & { change: (design: Design) => void };

function Chip({
  testID,
  selected,
  label,
  onPress,
  disabled,
  children,
}: {
  testID: string;
  selected: boolean;
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: MIN_TOUCH_TARGET,
        minWidth: MIN_TOUCH_TARGET,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.sm,
        borderWidth: selected ? 3 : 1,
        borderColor: selected ? colors.primary : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </Pressable>
  );
}

function PaperTray({ design, change, testID, designEditable }: TrayProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <ScrollView horizontal contentContainerStyle={{ gap: spacing.sm }}>
      {DESIGN_CATALOG.papers.map((paper) => (
        <Chip
          key={paper.key}
          testID={`${testID}-paper-${paper.key}`}
          selected={design.paper === paper.key}
          disabled={!designEditable}
          onPress={() => change({ ...design, paper: paper.key })}
        >
          <Image
            source={PAPER_TEXTURES[paper.key]}
            style={{ width: 56, height: 40, borderRadius: 4 }}
            accessible={false}
          />
          <AppText variant="muted">
            {t(`design.paperNames.${paper.key}` as 'design.paperNames.aged_cream')}
          </AppText>
        </Chip>
      ))}
    </ScrollView>
  );
}

function WriteTray({ design, change, testID, bodyDir, designEditable }: TrayProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <ScrollView horizontal contentContainerStyle={{ gap: spacing.sm }}>
        {fontsForDirection(bodyDir).map((font) => (
          <Chip
            key={font.key}
            testID={`${testID}-font-${font.key}`}
            selected={design.font === font.key}
            disabled={!designEditable}
            onPress={() => change({ ...design, font: font.key })}
          >
            <AppText style={{ fontFamily: font.family }}>
              {t(`design.fontNames.${font.key}` as 'design.fontNames.caveat')}
            </AppText>
            <AppText variant="muted">{t(`design.fontCategories.${font.category}`)}</AppText>
          </Chip>
        ))}
      </ScrollView>
      <ScrollView horizontal contentContainerStyle={{ gap: spacing.sm, alignItems: 'center' }}>
        {DESIGN_CATALOG.inks.map((ink) => (
          <Chip
            key={ink.key}
            testID={`${testID}-ink-${ink.key}`}
            label={t(`design.inkNames.${ink.key}` as 'design.inkNames.black')}
            selected={design.ink === ink.key}
            disabled={!designEditable}
            onPress={() => change({ ...design, ink: ink.key })}
          >
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: ink.color }} />
          </Chip>
        ))}
        {DESIGN_CATALOG.textSizes.map((size) => (
          <Chip
            key={size.key}
            testID={`${testID}-size-${size.key}`}
            label={`${t('design.sizeLabel')}: ${t(`design.textSizes.${size.key}`)}`}
            selected={design.textSize === size.key}
            disabled={!designEditable}
            onPress={() => change({ ...design, textSize: size.key })}
          >
            <AppText style={{ fontSize: size.size - 2 }}>
              {t(`design.textSizes.${size.key}`)}
            </AppText>
          </Chip>
        ))}
      </ScrollView>
    </View>
  );
}

function DecorateTray({
  testID,
  design,
  onAdd,
}: {
  testID: string;
  design: Design;
  onAdd: (type: ElementType, asset: string) => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const full = !canAddElement(design);
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="muted">
        {full ? t('desk.limit', { max: DESIGN_LIMITS.maxElements }) : t('desk.selectHint')}
      </AppText>
      {/* One row for all three kinds, so the sticky toolbar stays short. */}
      <ScrollView horizontal contentContainerStyle={{ gap: spacing.md }}>
        {ELEMENT_TYPES.map((type) => (
          <View key={type} style={{ gap: 2 }}>
            <AppText variant="muted">{t(`desk.sections.${type}`)}</AppText>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              {DESIGN_CATALOG.elements[type].map((entry) => (
                <Chip
                  key={entry.key}
                  testID={`${testID}-add-${entry.key}`}
                  label={t('desk.add', {
                    name: t(`design.elementNames.${entry.key}` as 'design.elementNames.stamp_dove'),
                  })}
                  selected={false}
                  disabled={full}
                  onPress={() => onAdd(type, entry.key)}
                >
                  <Image
                    source={ELEMENT_IMAGES[entry.key]}
                    resizeMode="contain"
                    style={{ width: 44, height: 40 }}
                    accessible={false}
                  />
                </Chip>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function SelectionBar({
  testID,
  el,
  onMove,
  onScale,
  onRotate,
  onLayer,
  onRemove,
  onDone,
}: {
  testID: string;
  el: DesignElement;
  onMove: (dx: number, dy: number) => void;
  onScale: (factor: number) => void;
  onRotate: (degrees: number) => void;
  onLayer: (step: 1 | -1) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  // Physical arrows on purpose: the sheet never mirrors, so "left" is left in both UI directions.
  const tools: { id: string; icon: IconName; label: string; onPress: () => void }[] = [
    {
      id: 'move-left',
      icon: 'arrow-back',
      label: t('desk.moveLeft'),
      onPress: () => onMove(-MOVE_STEP, 0),
    },
    {
      id: 'move-right',
      icon: 'arrow-forward',
      label: t('desk.moveRight'),
      onPress: () => onMove(MOVE_STEP, 0),
    },
    {
      id: 'move-up',
      icon: 'arrow-up',
      label: t('desk.moveUp'),
      onPress: () => onMove(0, -MOVE_STEP),
    },
    {
      id: 'move-down',
      icon: 'arrow-down',
      label: t('desk.moveDown'),
      onPress: () => onMove(0, MOVE_STEP),
    },
    {
      id: 'smaller',
      icon: 'remove-circle-outline',
      label: t('desk.smaller'),
      onPress: () => onScale(1 / SCALE_STEP),
    },
    {
      id: 'bigger',
      icon: 'add-circle-outline',
      label: t('desk.bigger'),
      onPress: () => onScale(SCALE_STEP),
    },
    {
      id: 'rotate-left',
      icon: 'refresh-outline',
      label: t('desk.rotateLeft'),
      onPress: () => onRotate(-ROTATE_STEP),
    },
    {
      id: 'rotate-right',
      icon: 'reload-outline',
      label: t('desk.rotateRight'),
      onPress: () => onRotate(ROTATE_STEP),
    },
    {
      id: 'backward',
      icon: 'chevron-down-circle-outline',
      label: t('desk.sendBackward'),
      onPress: () => onLayer(-1),
    },
    {
      id: 'forward',
      icon: 'chevron-up-circle-outline',
      label: t('desk.bringForward'),
      onPress: () => onLayer(1),
    },
    { id: 'remove', icon: 'trash-outline', label: t('desk.remove'), onPress: onRemove },
  ];
  const name = t(`design.elementNames.${el.asset}` as 'design.elementNames.stamp_dove');
  return (
    <View testID={`${testID}-selection`} style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText style={{ flex: 1 }}>{t('desk.selected', { name })}</AppText>
        <Pressable
          testID={`${testID}-sel-done`}
          accessibilityRole="button"
          onPress={onDone}
          style={{
            minHeight: MIN_TOUCH_TARGET,
            minWidth: MIN_TOUCH_TARGET,
            justifyContent: 'center',
          }}
        >
          <AppText style={{ color: colors.primary }}>{t('desk.done')}</AppText>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, direction: 'ltr' }}>
        {tools.map((tool) => (
          <Pressable
            key={tool.id}
            testID={`${testID}-sel-${tool.id}`}
            accessibilityRole="button"
            accessibilityLabel={tool.label}
            onPress={tool.onPress}
            style={{
              width: MIN_TOUCH_TARGET,
              height: MIN_TOUCH_TARGET,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: tool.id === 'remove' ? colors.danger : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={tool.icon}
              size={22}
              color={tool.id === 'remove' ? colors.danger : colors.text}
              // The anticlockwise icon is the clockwise one mirrored.
              style={tool.id === 'rotate-left' ? { transform: [{ scaleX: -1 }] } : undefined}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
