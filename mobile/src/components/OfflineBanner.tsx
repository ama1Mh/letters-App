import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsOnline } from '@/core/network/connectivity';
import { useTheme } from '@/core/theme/useTheme';

import { AppText } from './AppText';

/**
 * App-wide "you're offline" strip above every screen. While it shows, it takes the status-bar
 * inset itself and gives the screens below a top inset of 0, so stack headers are not padded
 * twice. Drafts keep working offline (they are stored on the phone); lists refresh by themselves
 * when the connection returns (LetterEventsProvider, useDrafts).
 */
export function OfflineBoundary({ children }: { children: ReactNode }) {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  if (online) return children;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        testID="offline-banner"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{
          paddingTop: insets.top + spacing.xs,
          paddingBottom: spacing.xs,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.text,
        }}
      >
        <AppText style={{ color: colors.background, textAlign: 'center' }}>
          {t('network.offline')}
        </AppText>
      </View>
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
