import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { majorStringToMinorUnits } from '@noorixfin/money';
import { apiFetch } from '../src/lib/api';
import { useWorkspace } from '../src/lib/WorkspaceContext';
import { confirmHaptic, selectionHaptic } from '../src/lib/haptics';
import { Button, Card, Choice, Empty, Field, Notice, Screen, primitiveStyles } from '../src/components/ScreenPrimitives';
import { useTranslation } from 'react-i18next';

type EntryType = 'EXPENSE' | 'INCOME';
type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
type Rule = { id: string; name: string; entry_type: string; amount_minor: number; currency_code: string; frequency: string; next_occurrence: string; status: 'ACTIVE' | 'PAUSED' | 'ENDED' };
const nextMonth = () => { const date = new Date(); date.setMonth(date.getMonth() + 1); return date.toISOString().slice(0, 10); };

export default function RecurringScreen() {
  const { workspaceId, workspaceCurrency } = useWorkspace();
  const { t } = useTranslation();
  const [rules, setRules] = useState<Rule[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(nextMonth);
  const [entryType, setEntryType] = useState<EntryType>('EXPENSE');
  const [frequency, setFrequency] = useState<Frequency>('MONTHLY');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!workspaceId) return;
    try { setRules(await apiFetch(`/workspaces/${workspaceId}/recurring`)); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load recurring rules'); }
  }, [workspaceId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const create = async () => {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await apiFetch(`/workspaces/${workspaceId}/recurring`, { method: 'POST', body: { name: name.trim(), entry_type: entryType, amount_minor: String(majorStringToMinorUnits(amount, workspaceCurrency)), currency_code: workspaceCurrency, frequency, next_occurrence: date, behavior: 'REMIND_ONLY' } });
      setName(''); setAmount(''); await load(); confirmHaptic();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create recurring rule'); }
    finally { setBusy(false); }
  };
  const mutate = async (rule: Rule, remove = false) => {
    if (!workspaceId) return;
    if (remove) await apiFetch(`/workspaces/${workspaceId}/recurring/${rule.id}`, { method: 'DELETE' });
    else await apiFetch(`/workspaces/${workspaceId}/recurring/${rule.id}`, { method: 'PATCH', body: { status: rule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } });
    await load(); confirmHaptic();
  };
  return (
    <Screen title={t('mobile.management.recurring')}>
      <Field label={t('mobile.management.ruleName')} value={name} onChangeText={setName} />
      <Choice label={t('mobile.management.entryType')} value={entryType} options={['EXPENSE', 'INCOME']} onChange={(value) => { selectionHaptic(); setEntryType(value); }} />
      <Field label={t('mobile.management.amount', { currency: workspaceCurrency })} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Choice label={t('mobile.management.frequency')} value={frequency} options={['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']} onChange={(value) => { selectionHaptic(); setFrequency(value); }} />
      <Field label={t('mobile.management.nextOccurrence')} value={date} onChangeText={setDate} autoCapitalize="none" />
      <Button label={t('mobile.management.createRule')} onPress={() => void create()} busy={busy} disabled={!name.trim() || !amount.trim() || !date} />
      {error ? <Notice error>{error}</Notice> : null}
      {rules.length === 0 ? <Empty>{t('mobile.management.noRules')}</Empty> : rules.map((rule) => (
        <Card key={rule.id}>
          <View style={primitiveStyles.between}><Text style={primitiveStyles.cardTitle}>{rule.name}</Text><Text style={primitiveStyles.secondary}>{rule.status}</Text></View>
          <Text style={primitiveStyles.secondary}>{rule.entry_type} · {rule.amount_minor} {rule.currency_code} · {rule.frequency} · {rule.next_occurrence}</Text>
          <Button label={t(rule.status === 'ACTIVE' ? 'mobile.management.pause' : 'mobile.management.resume', { name: rule.name })} onPress={() => void mutate(rule)} />
          <Button label={t('mobile.management.deleteNamed', { name: rule.name })} destructive onPress={() => Alert.alert(t('mobile.management.delete'), rule.name, [{ text: t('mobile.common.cancel'), style: 'cancel' }, { text: t('mobile.management.delete'), style: 'destructive', onPress: () => void mutate(rule, true) }])} />
        </Card>
      ))}
    </Screen>
  );
}
