import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { useTheme } from '@/core/theme/useTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * The tab bar has a fixed height, so at the largest system font sizes the labels were cut off at
 * the bottom (phone QA, font scale 2.0). Labels still grow, up to 1.5x; each tab also has an icon,
 * and screen content keeps scaling fully.
 */
const TAB_LABEL_MAX_FONT_SCALE = 1.5;

const TABS = [
  { name: 'inbox', titleKey: 'tabs.inbox', icon: 'mail-outline' },
  { name: 'drafts', titleKey: 'tabs.drafts', icon: 'document-text-outline' },
  { name: 'sent', titleKey: 'tabs.sent', icon: 'paper-plane-outline' },
  { name: 'profile', titleKey: 'tabs.profile', icon: 'person-outline' },
] as const satisfies readonly { name: string; titleKey: string; icon: IconName }[];

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.titleKey),
            // Language-independent selector for Maestro (.maestro/) and tests.
            tabBarButtonTestID: `tab-${tab.name}`,
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} size={size} color={color} />,
            tabBarLabel: ({ color, children }) => (
              <Text
                testID={`tab-${tab.name}-label`}
                maxFontSizeMultiplier={TAB_LABEL_MAX_FONT_SCALE}
                numberOfLines={1}
                style={{ color, fontSize: 10, textAlign: 'center' }}
              >
                {children}
              </Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
