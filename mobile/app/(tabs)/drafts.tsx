import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/core/theme/useTheme';
import type { LocalDraft } from '@/data/local/draftsStore';
import { useDrafts } from '@/features/drafts/useDrafts';

export default function DraftsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { drafts, refresh } = useDrafts();

  // Refresh on every visit, not just first mount: coming back from editing/deleting a draft, or
  // returning to the app online after drafting offline, should show the current list.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  function renderItem({ item }: { item: LocalDraft }) {
    return (
      <Pressable
        testID={`draft-row-${item.id}`}
        accessibilityRole="button"
        onPress={() => router.push(`/compose/${item.id}`)}
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: spacing.xs,
        }}
      >
        <AppText variant="title">
          {item.subject && item.subject.trim() ? item.subject : t('drafts.untitled')}
        </AppText>
        {item.body ? (
          <AppText
            variant="muted"
            numberOfLines={1}
            // A letter's own direction (body_dir), independent of the UI's: Text does not
            // auto-detect content direction the way TextInput does (OPEN-4 spike finding).
            style={{
              textAlign: item.bodyDir === 'rtl' ? 'right' : 'left',
              writingDirection: item.bodyDir,
            }}
          >
            {item.body}
          </AppText>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View testID="drafts-screen" style={{ flex: 1, backgroundColor: colors.background }}>
      <Pressable
        testID="drafts-new-button"
        accessibilityRole="button"
        onPress={() => router.push(`/compose/${randomUUID()}`)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          margin: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: radius.md,
          backgroundColor: colors.primary,
        }}
      >
        <Ionicons name="add" size={18} color={colors.onPrimary} />
        <AppText style={{ color: colors.onPrimary, fontWeight: '600' }}>
          {t('drafts.newButton')}
        </AppText>
      </Pressable>
      {drafts.length === 0 ? (
        <EmptyState
          testID="drafts-empty"
          title={t('drafts.emptyTitle')}
          body={t('drafts.emptyBody')}
        />
      ) : (
        <FlatList data={drafts} keyExtractor={(item) => item.id} renderItem={renderItem} />
      )}
    </View>
  );
}
