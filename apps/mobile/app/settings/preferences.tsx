import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { isSupportedLocale, type SupportedLanguage } from '@noorixfin/i18n';
import { apiFetch } from '../../src/lib/api';
import { activeMobileLocale, changeMobileLocale } from '../../src/lib/i18n';
import { useWorkspace } from '../../src/lib/WorkspaceContext';
import { Colors, Radius, Spacing, Typography } from '../../src/lib/theme';

const LANGUAGES: Array<{ locale: SupportedLanguage; key: string }> = [
  { locale: 'bn', key: 'mobile.preferences.bangla' },
  { locale: 'en', key: 'mobile.preferences.english' },
];

export default function PreferencesScreen() {
  const { t, i18n } = useTranslation();
  const { workspaceCurrency } = useWorkspace();
  const [saving, setSaving] = useState<SupportedLanguage | null>(null);
  const current = isSupportedLocale(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : activeMobileLocale();

  async function selectLanguage(locale: SupportedLanguage) {
    if (locale === current || saving) return;
    setSaving(locale);
    try {
      await apiFetch('/me/preferences', {
        method: 'PATCH',
        body: { locale },
      });
      await changeMobileLocale(locale);
      Alert.alert(t('mobile.common.saved'), t('mobile.preferences.saved'));
    } catch (error) {
      Alert.alert(
        t('mobile.common.error'),
        error instanceof Error ? error.message : t('mobile.lock.failed'),
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        <View style={styles.group} accessibilityRole="radiogroup">
          {LANGUAGES.map(({ locale, key }) => {
            const selected = current === locale;
            return (
              <Pressable
                key={locale}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: saving !== null }}
                onPress={() => void selectLanguage(locale)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={styles.rowLabel}>{t(key)}</Text>
                {saving === locale ? (
                  <ActivityIndicator color={Colors.accent} />
                ) : selected ? (
                  <Check size={20} color={Colors.accent} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>{t('settings.currency')}</Text>
        <View style={styles.readOnlyCard}>
          <Text style={styles.rowLabel}>{workspaceCurrency}</Text>
          <Text style={styles.readOnlyHint}>{t('settings.currency')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, gap: Spacing.sm },
  sectionTitle: { ...Typography.label, marginTop: Spacing.md },
  group: {
    overflow: 'hidden',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pressed: { backgroundColor: Colors.bgElevated },
  rowLabel: { ...Typography.body, fontWeight: '600' },
  readOnlyCard: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.md,
  },
  readOnlyHint: { ...Typography.caption },
});
