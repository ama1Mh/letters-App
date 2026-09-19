import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { changeLanguagePreference, i18n } from '@/core/i18n';
import { reloadApp } from '@/core/i18n/direction';
import type { LanguagePreference } from '@/core/i18n/languages';
import { getLanguagePreference } from '@/core/i18n/preference';
import { useTheme } from '@/core/theme/useTheme';

const OPTIONS = [
  { value: 'system', labelKey: 'language.system', hintKey: 'language.systemHint' },
  { value: 'en', labelKey: 'language.english' },
  { value: 'ar', labelKey: 'language.arabic' },
] as const satisfies readonly {
  value: LanguagePreference;
  labelKey: string;
  hintKey?: string;
}[];

export default function LanguageScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [selected, setSelected] = useState<LanguagePreference>(getLanguagePreference);

  async function choose(value: LanguagePreference) {
    const { needsReload } = await changeLanguagePreference(value);
    setSelected(value);
    if (needsReload) {
      // Use the global instance: it is already in the new language, unlike this render's `t`.
      Alert.alert(i18n.t('language.restartTitle'), i18n.t('language.restartMessage'), [
        { text: i18n.t('language.restartLater'), style: 'cancel' },
        { text: i18n.t('language.restartNow'), onPress: reloadApp },
      ]);
    }
  }

  return (
    <View testID="language-screen" style={{ flex: 1, backgroundColor: colors.background }}>
      {OPTIONS.map((option) => {
        const checked = selected === option.value;
        return (
          <Pressable
            key={option.value}
            testID={`language-option-${option.value}`}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            onPress={() => void choose(option.value)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <AppText>{t(option.labelKey)}</AppText>
              {'hintKey' in option ? <AppText variant="muted">{t(option.hintKey)}</AppText> : null}
            </View>
            {checked ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
