import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsOnline } from '@/core/network/connectivity';
import { useTheme } from '@/core/theme/useTheme';

import { AppText } from './AppText';

/**
 * App-wide "you're offline" strip below every screen (under the tab bar). It sits at the bottom
 * because native-stack headers add the status-bar inset natively, so a strip at the top left a
 * double gap under it on the phone (QA 2026-10-01); at the bottom it takes the navigation-bar
 * inset itself and gives the screens above a bottom inset of 0, so the tab bar is not padded twice.
 * Drafts keep working offline (they are stored on the phone); lists refresh by themselves when the
 * connection returns (LetterEventsProvider, useDrafts).
 */
export function OfflineBoundary({ children }: { children: ReactNode }) {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  // Same tree shape online and offline: only the strip comes and goes, so toggling it never
  // remounts the navigator (which would drop unsaved screen state such as a half-typed draft).
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <SafeAreaInsetsContext.Provider value={online ? insets : { ...insets, bottom: 0 }}>
          {children}
        </SafeAreaInsetsContext.Provider>
      </View>
      {online ? null : (
        <View
          testID="offline-banner"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            paddingHorizontal: spacing.lg,
            backgroundColor: colors.text,
          }}
        >
          <AppText style={{ color: colors.background, textAlign: 'center' }}>
            {t('network.offline')}
          </AppText>
        </View>
      )}
    </View>
  );
}
