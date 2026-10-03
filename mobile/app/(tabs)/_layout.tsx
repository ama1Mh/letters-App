import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, Text, type ImageSourcePropType } from 'react-native';

import { useTheme } from '@/core/theme/useTheme';

/**
 * The tab bar has a fixed height, so at the largest system font sizes the labels were cut off at
 * the bottom (phone QA, font scale 2.0). Labels still grow, up to 1.5x; each tab also has an icon,
 * and screen content keeps scaling fully.
 */
const TAB_LABEL_MAX_FONT_SCALE = 1.5;

/**
 * Mirsal's own stationery icons (Phase 13; drawn by tools/brand/generate_brand.py): an opened
 * envelope, a quill, a stamped envelope and a cameo portrait. One-colour PNGs tinted by the tab bar
 * (active heritage green, inactive sepia), so they follow both themes.
 */
const TABS = [
  { name: 'inbox', titleKey: 'tabs.inbox', icon: require('../../assets/icons/tab-inbox.png') },
  { name: 'drafts', titleKey: 'tabs.drafts', icon: require('../../assets/icons/tab-drafts.png') },
  { name: 'sent', titleKey: 'tabs.sent', icon: require('../../assets/icons/tab-sent.png') },
  {
    name: 'profile',
    titleKey: 'tabs.profile',
    icon: require('../../assets/icons/tab-profile.png'),
  },
] as const satisfies readonly { name: string; titleKey: string; icon: ImageSourcePropType }[];

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors, fonts } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 26 },
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
            tabBarIcon: ({ color, size }) => (
              <Image
                source={tab.icon}
                accessible={false}
                style={{ width: size + 2, height: size + 2, tintColor: color }}
              />
            ),
            tabBarLabel: ({ color, children }) => (
              <Text
                testID={`tab-${tab.name}-label`}
                maxFontSizeMultiplier={TAB_LABEL_MAX_FONT_SCALE}
                numberOfLines={1}
                style={{ color, fontSize: 11, textAlign: 'center' }}
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
