import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/useTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

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
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
