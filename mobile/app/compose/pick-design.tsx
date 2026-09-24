import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { DirectionalIcon } from '@/components/DirectionalIcon';
import { useTheme } from '@/core/theme/useTheme';
import { getDraftsRepository } from '@/data/letters/draftsRepository';
import type { LocalDraft } from '@/data/local/draftsStore';
import {
  DESIGN_CATALOG,
  defaultDesign,
  fontsForDirection,
  normalizeDesign,
  type Design,
} from '@/domain/design';
import { LetterRenderer } from '@/features/designs/LetterRenderer';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Reached from the compose screen ("Change design"), draft id passed as a query param rather than
 * a second dynamic route segment. Every tap saves immediately (through the same drafts repository
 * compose autosaves through) - discrete choices, not continuous typing, so there is nothing to
 * debounce and no separate "Done" step; the live preview is the same LetterRenderer the compose
 * screen itself uses.
 */
export default function PickDesignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();

  // No early `return null` while loading: the screen renders immediately with defaults (same
  // approach as compose/[id].tsx) and re-renders once the real draft arrives, a render frame or
  // two later at most.
  const [draft, setDraft] = useState<LocalDraft | null>(null);
  const [design, setDesign] = useState<Design>(defaultDesign());

  useEffect(() => {
    let cancelled = false;
    void getDraftsRepository()
      .get(id)
      .then((found) => {
        if (cancelled) return;
        setDraft(found);
        setDesign(normalizeDesign(found?.design));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const bodyDir = draft?.bodyDir ?? 'ltr';

  async function apply(patch: Partial<Design>) {
    const next = { ...design, ...patch };
    setDesign(next);
    await getDraftsRepository().save({
      id,
      subject: draft?.subject ?? null,
      body: draft?.body ?? '',
      recipientId: draft?.recipientId ?? null,
      design: next,
    });
  }

  return (
    <ScrollView
      testID="pick-design-screen"
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      style={{ backgroundColor: colors.background }}
    >
      <Pressable
        testID="pick-design-back"
        accessibilityRole="button"
        onPress={() => router.back()}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
      >
        <DirectionalIcon name="chevron-back" size={18} color={colors.primary} />
        <AppText style={{ color: colors.primary }}>{t('compose.title')}</AppText>
      </Pressable>

      <LetterRenderer
        testID="pick-design-preview"
        design={design}
        subject={draft?.subject}
        body={draft?.body ?? ''}
        bodyDir={bodyDir}
      />

      <View style={{ gap: spacing.sm }}>
        <AppText variant="title">{t('design.paperLabel')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {DESIGN_CATALOG.papers.map((paper) => (
            <Pressable
              key={paper.key}
              testID={`pick-design-paper-${paper.key}`}
              accessibilityRole="button"
              accessibilityLabel={t(`design.paperNames.${paper.key}` as 'design.paperNames.cream')}
              accessibilityState={{ selected: design.paper === paper.key }}
              onPress={() => void apply({ paper: paper.key })}
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.lg,
                backgroundColor: paper.color,
                borderWidth: design.paper === paper.key ? 3 : 1,
                borderColor: design.paper === paper.key ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="title">{t('design.fontLabel')}</AppText>
        <View style={{ gap: spacing.xs }}>
          {fontsForDirection(bodyDir).map((font) => (
            <Pressable
              key={font.key}
              testID={`pick-design-font-${font.key}`}
              accessibilityRole="button"
              accessibilityState={{ selected: design.font === font.key }}
              onPress={() => void apply({ font: font.key })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: design.font === font.key ? colors.primary : colors.border,
              }}
            >
              <AppText style={{ fontFamily: font.family }}>
                {t(`design.fontNames.${font.key}` as 'design.fontNames.caveat')}
              </AppText>
              {design.font === font.key ? (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="title">{t('design.inkLabel')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {DESIGN_CATALOG.inks.map((ink) => (
            <Pressable
              key={ink.key}
              testID={`pick-design-ink-${ink.key}`}
              accessibilityRole="button"
              accessibilityLabel={t(
                `design.inkNames.${ink.key}` as 'design.inkNames.classic_black',
              )}
              accessibilityState={{ selected: design.ink === ink.key }}
              onPress={() => void apply({ ink: ink.key })}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: ink.color,
                borderWidth: design.ink === ink.key ? 3 : 1,
                borderColor: design.ink === ink.key ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="title">{t('design.stampLabel')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Pressable
            testID="pick-design-stamp-none"
            accessibilityRole="button"
            accessibilityLabel={t('design.noStamp')}
            accessibilityState={{ selected: design.stamp === null }}
            onPress={() => void apply({ stamp: null })}
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.sm,
              borderWidth: design.stamp === null ? 3 : 1,
              borderColor: design.stamp === null ? colors.primary : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
          {DESIGN_CATALOG.stamps.map((stamp) => (
            <Pressable
              key={stamp.key}
              testID={`pick-design-stamp-${stamp.key}`}
              accessibilityRole="button"
              accessibilityLabel={t(`design.stampNames.${stamp.key}` as 'design.stampNames.heart')}
              accessibilityState={{ selected: design.stamp === stamp.key }}
              onPress={() => void apply({ stamp: stamp.key })}
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.sm,
                borderWidth: design.stamp === stamp.key ? 3 : 1,
                borderColor: design.stamp === stamp.key ? colors.primary : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={stamp.icon as IconName} size={20} color={colors.text} />
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
