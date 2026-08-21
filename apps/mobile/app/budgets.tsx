import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { majorStringToMinorUnits } from '@noorixfin/money';
import { apiFetch } from '../src/lib/api';
import { useWorkspace } from '../src/lib/WorkspaceContext';
import { listCategories, type CategoryRow } from '../src/repositories/categories';
import { confirmHaptic, selectionHaptic } from '../src/lib/haptics';
import { Button, Card, Choice, Empty, Field, Notice, Screen, primitiveStyles } from '../src/components/ScreenPrimitives';
import { Colors, Radius, Spacing } from '../src/lib/theme';
import { useTranslation } from 'react-i18next';

type Cadence = 'MONTHLY' | 'WEEKLY';
type BudgetStatus = { has_budget?: boolean; budget_id?: string; name?: string; cadence?: Cadence; lines?: Array<{ category_id: string; planned_minor: number; spent_minor: number; name: string }> };

export default function BudgetsScreen() {
  const { workspaceId, workspaceCurrency } = useWorkspace();
  const { t } = useTranslation();
  const [status, setStatus] = useState<BudgetStatus>({});
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [name, setName] = useState('Monthly budget');
  const [cadence, setCadence] = useState<Cadence>('MONTHLY');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [budget, expenseCategories] = await Promise.all([
        apiFetch(`/workspaces/${workspaceId}/budget`),
        listCategories(workspaceId, 'EXPENSE'),
      ]);
      setStatus(budget); setCategories(expenseCategories);
      if (budget.name) setName(budget.name);
      if (budget.cadence) setCadence(budget.cadence);
      setValues(Object.fromEntries((budget.lines ?? []).map((line) => [line.category_id, String(line.planned_minor / 100)])));
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load budget'); }
  }, [workspaceId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const save = async () => {
    if (!workspaceId) return;
    setBusy(true);
    try {
      const lines = categories.flatMap((category) => {
        const value = values[category.id]?.trim();
        return value ? [{ category_id: category.id, planned_minor: String(majorStringToMinorUnits(value, workspaceCurrency)), alert_threshold_pct: 80 }] : [];
      });
      if (!lines.length) throw new Error('Enter at least one category limit.');
      await apiFetch(`/workspaces/${workspaceId}/budget`, { method: 'PUT', body: { name: name.trim(), cadence, rollover: false, lines } });
      await load(); confirmHaptic();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save budget'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!workspaceId || !status.budget_id) return;
    await apiFetch(`/workspaces/${workspaceId}/budget/${status.budget_id}`, { method: 'DELETE' });
    setValues({}); await load(); confirmHaptic();
  };
  return (
    <Screen title={t('mobile.management.budget')}>
      <Field label={t('mobile.management.budgetName')} value={name} onChangeText={setName} />
      <Choice label={t('mobile.management.cadence')} value={cadence} options={['MONTHLY', 'WEEKLY']} onChange={(value) => { selectionHaptic(); setCadence(value); }} />
      <Text style={primitiveStyles.section}>{t('mobile.management.categoryLimits', { currency: workspaceCurrency })}</Text>
      {categories.length === 0 ? <Empty>{t('mobile.management.noCategories')}</Empty> : categories.map((category) => {
        const label = category.custom_name ?? category.translation_key ?? category.id;
        return (
          <View key={category.id} style={styles.line}>
            <Text style={styles.lineLabel}>{category.icon} {label}</Text>
            <TextInput accessibilityLabel={`${label} budget limit`} style={styles.lineInput} value={values[category.id] ?? ''} onChangeText={(value) => setValues((current) => ({ ...current, [category.id]: value }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.textFaint} />
          </View>
        );
      })}
      <Button label={t('mobile.management.saveBudget')} onPress={() => void save()} busy={busy} />
      {status.has_budget && status.budget_id ? <Button label={t('mobile.management.deleteBudget')} destructive onPress={() => Alert.alert(t('mobile.management.deleteBudget'), 'Actual ledger entries are not affected.', [{ text: t('mobile.common.cancel'), style: 'cancel' }, { text: t('mobile.management.delete'), style: 'destructive', onPress: () => void remove() }])} /> : null}
      {error ? <Notice error>{error}</Notice> : null}
      {(status.lines ?? []).map((line) => <Card key={line.category_id}><Text style={primitiveStyles.cardTitle}>{line.name}</Text><Text style={primitiveStyles.secondary}>Planned {line.planned_minor} · spent {line.spent_minor}</Text></Card>)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  lineLabel: { flex: 1, color: Colors.text },
  lineInput: { width: 120, minHeight: 48, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.bgCard, borderRadius: Radius.md, color: Colors.text, paddingHorizontal: Spacing.md, textAlign: 'right' },
});
