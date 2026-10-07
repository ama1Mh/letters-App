import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { TextDirection } from '@/domain/bodyDirection';
import { DESIGN_LIMITS, elementEntry, type DesignElement } from '@/domain/design';
import { ELEMENT_IMAGES } from '@/features/designs/designAssets';
import { CANVAS_WIDTH, elementBox, postmarkDateText } from '@/features/designs/LetterCanvas';

const HANDLE = 36; // logical units; at least 48 dp touch area through hitSlop

export interface ElementPatch {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface DraggableElementProps {
  el: DesignElement;
  /** Display width / 360: converts finger movement (screen dp) into sheet units. */
  sheetScale: number;
  bodyDir: TextDirection;
  postmarkDate: Date;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  /** Called once per finished gesture (never per frame), with the new raw values. */
  onCommit: (id: string, patch: ElementPatch) => void;
  testID?: string;
}

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/**
 * A decoration on the desk in Decorate mode (Phase 12.5): tap selects; drag moves; two-finger pinch
 * resizes and two-finger twist rotates (simultaneously); the selected element also shows a corner
 * handle that resizes and rotates with one finger. Everything runs on the UI thread with Reanimated
 * and commits to the design only when the gesture ends. Every gesture has a labelled button in the
 * selection bar (accessibility, Maestro).
 */
export function DraggableElement({
  el,
  sheetScale,
  bodyDir,
  postmarkDate,
  selected,
  onSelect,
  onToggle,
  onCommit,
  testID,
}: DraggableElementProps) {
  const { t } = useTranslation();
  const entry = elementEntry(el.type, el.asset);
  // Drawn at scale 1 and scaled by transform while gesturing; the committed design re-renders it.
  const base = elementBox({ ...el, scale: 1 });
  const dateText = entry?.dated ? postmarkDateText(postmarkDate, bodyDir) : null;
  const name = t(`design.elementNames.${el.asset}` as 'design.elementNames.stamp_dove');

  // Live values in logical sheet units / degrees.
  const cx = useSharedValue(el.x * CANVAS_WIDTH);
  const cy = useSharedValue(el.y * CANVAS_WIDTH);
  const s = useSharedValue(el.scale);
  const r = useSharedValue(el.rotation);
  const active = useSharedValue(0);
  const start = useSharedValue({ cx: 0, cy: 0, s: 1, r: 0, ax: 0, ay: 0, hx: 0, hy: 0 });

  // Follow the design (buttons, undo, reload) whenever no gesture is running.
  useEffect(() => {
    if (active.get() > 0) return;
    cx.set(el.x * CANVAS_WIDTH);
    cy.set(el.y * CANVAS_WIDTH);
    s.set(el.scale);
    r.set(el.rotation);
  }, [el.x, el.y, el.scale, el.rotation, active, cx, cy, s, r]);

  const gesture = useMemo(() => {
    const maxY = DESIGN_LIMITS.maxY * CANVAS_WIDTH;
    const commit = (x: number, y: number, scale: number, rotation: number) =>
      onCommit(el.id, { x: x / CANVAS_WIDTH, y: y / CANVAS_WIDTH, scale, rotation });
    const begin = () => {
      'worklet';
      active.set(active.get() + 1);
      start.set({ ...start.get(), cx: cx.get(), cy: cy.get(), s: s.get(), r: r.get() });
    };
    const end = () => {
      'worklet';
      active.set(Math.max(0, active.get() - 1));
      if (active.get() === 0) scheduleOnRN(commit, cx.get(), cy.get(), s.get(), r.get());
    };

    const tap = Gesture.Tap().onEnd(() => {
      'worklet';
      scheduleOnRN(onToggle, el.id);
    });
    // Absolute screen positions divided by the sheet scale, so the element stays under the finger
    // whatever transform the sheet has; activates after 2 dp.
    const pan = Gesture.Pan()
      .minDistance(2)
      // The finger's touch-down point, not the activation point: measured from there the element
      // stays exactly under the finger (phone check: activating first lost ~7 dp).
      .onBegin((e) => {
        'worklet';
        start.set({ ...start.get(), ax: e.absoluteX, ay: e.absoluteY });
      })
      .onStart(() => {
        'worklet';
        const { ax, ay } = start.get();
        begin();
        start.set({ ...start.get(), ax, ay });
        scheduleOnRN(onSelect, el.id);
      })
      .onUpdate((e) => {
        'worklet';
        cx.set(
          clamp(start.get().cx + (e.absoluteX - start.get().ax) / sheetScale, 0, CANVAS_WIDTH),
        );
        cy.set(clamp(start.get().cy + (e.absoluteY - start.get().ay) / sheetScale, 0, maxY));
      })
      .onEnd(end);
    const pinch = Gesture.Pinch()
      .onStart(() => {
        'worklet';
        begin();
        scheduleOnRN(onSelect, el.id);
      })
      .onUpdate((e) => {
        'worklet';
        s.set(clamp(start.get().s * e.scale, DESIGN_LIMITS.minScale, DESIGN_LIMITS.maxScale));
      })
      .onEnd(end);
    const rotate = Gesture.Rotation()
      .onStart(begin)
      .onUpdate((e) => {
        'worklet';
        r.set(start.get().r + (e.rotation * 180) / Math.PI);
      })
      .onEnd(end);
    return Gesture.Simultaneous(tap, pan, pinch, rotate);
  }, [el.id, sheetScale, onCommit, onSelect, onToggle, active, start, cx, cy, s, r]);

  // One finger on the corner handle: the vector from the centre to the finger sets size and angle.
  const handleGesture = useMemo(() => {
    const commit = (x: number, y: number, scale: number, rotation: number) =>
      onCommit(el.id, { x: x / CANVAS_WIDTH, y: y / CANVAS_WIDTH, scale, rotation });
    return Gesture.Pan()
      .minDistance(1)
      .onStart((e) => {
        'worklet';
        active.set(active.get() + 1);
        const rad = (r.get() * Math.PI) / 180;
        const hx = ((base.width / 2) * Math.cos(rad) - (base.height / 2) * Math.sin(rad)) * s.get();
        const hy = ((base.width / 2) * Math.sin(rad) + (base.height / 2) * Math.cos(rad)) * s.get();
        start.set({
          cx: cx.get(),
          cy: cy.get(),
          s: s.get(),
          r: r.get(),
          ax: e.absoluteX,
          ay: e.absoluteY,
          hx,
          hy,
        });
      })
      .onUpdate((e) => {
        'worklet';
        const nx = start.get().hx + (e.absoluteX - start.get().ax) / sheetScale;
        const ny = start.get().hy + (e.absoluteY - start.get().ay) / sheetScale;
        const d0 = Math.hypot(start.get().hx, start.get().hy);
        const d1 = Math.hypot(nx, ny);
        if (d0 > 0) {
          s.set(clamp((start.get().s * d1) / d0, DESIGN_LIMITS.minScale, DESIGN_LIMITS.maxScale));
        }
        const delta = Math.atan2(ny, nx) - Math.atan2(start.get().hy, start.get().hx);
        r.set(start.get().r + (delta * 180) / Math.PI);
      })
      .onEnd(() => {
        'worklet';
        active.set(Math.max(0, active.get() - 1));
        scheduleOnRN(commit, cx.get(), cy.get(), s.get(), r.get());
      });
  }, [el.id, base.width, base.height, sheetScale, onCommit, active, start, cx, cy, s, r]);

  const elementStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cx.get() - base.width / 2 },
      { translateY: cy.get() - base.height / 2 },
      { rotate: `${r.get()}deg` },
      { scale: s.get() },
    ],
  }));
  const handleStyle = useAnimatedStyle(() => {
    const rad = (r.get() * Math.PI) / 180;
    const hx = ((base.width / 2) * Math.cos(rad) - (base.height / 2) * Math.sin(rad)) * s.get();
    const hy = ((base.width / 2) * Math.sin(rad) + (base.height / 2) * Math.cos(rad)) * s.get();
    return {
      transform: [
        { translateX: cx.get() + hx - HANDLE / 2 },
        { translateY: cy.get() + hy - HANDLE / 2 },
      ],
    };
  });

  return (
    <>
      <GestureDetector gesture={gesture}>
        <Animated.View
          testID={testID}
          accessible
          accessibilityRole="button"
          accessibilityLabel={dateText ? `${name}, ${dateText}` : name}
          accessibilityState={{ selected }}
          onAccessibilityTap={() => onToggle(el.id)}
          style={[
            { position: 'absolute', top: 0, start: 0, width: base.width, height: base.height },
            elementStyle,
          ]}
        >
          <Image
            source={ELEMENT_IMAGES[el.asset]}
            resizeMode="contain"
            style={{ width: base.width, height: base.height }}
          />
          {dateText ? (
            <View
              style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{
                  fontFamily: bodyDir === 'rtl' ? 'Amiri_400Regular' : 'IMFellEnglish_400Regular',
                  fontSize: base.width * 0.105,
                  color: 'rgba(40, 45, 70, 0.85)',
                  writingDirection: bodyDir,
                }}
              >
                {dateText}
              </Text>
            </View>
          ) : null}
          {selected ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderWidth: 2 / Math.max(0.3, el.scale),
                  borderStyle: 'dashed',
                  borderColor: '#B45309',
                  borderRadius: 4,
                },
              ]}
            />
          ) : null}
        </Animated.View>
      </GestureDetector>
      {selected ? (
        <GestureDetector gesture={handleGesture}>
          <Animated.View
            testID={testID ? `${testID}-handle` : undefined}
            // The selection bar's labelled buttons are the accessible way to resize and rotate.
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            hitSlop={8}
            style={[
              {
                position: 'absolute',
                top: 0,
                start: 0,
                width: HANDLE,
                height: HANDLE,
                borderRadius: HANDLE / 2,
                backgroundColor: '#B45309',
                borderWidth: 3,
                borderColor: '#FFFFFF',
              },
              handleStyle,
            ]}
          />
        </GestureDetector>
      ) : null}
    </>
  );
}
