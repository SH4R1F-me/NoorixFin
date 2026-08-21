import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { majorStringToMinorUnits } from '@noorixfin/money';
import { apiFetch } from '../src/lib/api';
import { useWorkspace } from '../src/lib/WorkspaceContext';
import { listAccounts, type AccountRow } from '../src/repositories/accounts';
import { confirmHaptic, selectionHaptic } from '../src/lib/haptics';
import { Button, Card, Empty, Field, Notice, Screen, primitiveStyles } from '../src/components/ScreenPrimitives';
import { Colors, Radius, Spacing, Typography } from '../src/lib/theme';
import { useTranslation } from 'react-i18next';

type Debt = { ledger_account_id: string; name: string; currency_code: string; principal_minor: number; outstanding_minor: number; annual_rate_bps: number | null; minimum_payment_minor: number | null; due_day: number | null };

export default function DebtsScreen() {
  const { workspaceId, workspaceCurrency } = useWorkspace();
  const { t } = useTranslation();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [accountId, setAccountId] = useState('');
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [minimum, setMinimum] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [overview, localAccounts] = await Promise.all([apiFetch(`/workspaces/${workspaceId}/debts`), listAccounts(workspaceId)]);
      const liabilities = localAccounts.filter((account) => account.class === 'LIABILITY');
      setDebts(overview.debts ?? []); setAccounts(liabilities); setAccountId((current) => current || liabilities[0]?.id || ''); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load debts'); }
  }, [workspaceId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const save = async () => {
    if (!workspaceId || !accountId) return;
    setBusy(true);
    try {
      await apiFetch(`/workspaces/${workspaceId}/debts`, { method: 'PUT', body: { ledger_account_id: accountId, principal_minor: String(majorStringToMinorUnits(principal, workspaceCurrency)), ...(rate ? { annual_rate_bps: Math.round(Number(rate) * 100) } : {}), ...(minimum ? { minimum_payment_minor: String(majorStringToMinorUnits(minimum, workspaceCurrency)) } : {}), ...(dueDay ? { due_day: Number(dueDay) } : {}) } });
      setPrincipal(''); setRate(''); setMinimum(''); setDueDay(''); await load(); confirmHaptic();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save debt terms'); }
    finally { setBusy(false); }
  };
  const remove = async (debt: Debt) => {
    if (!workspaceId) return;
    await apiFetch(`/workspaces/${workspaceId}/debts/${debt.ledger_account_id}`, { method: 'DELETE' });
    await load(); confirmHaptic();
  };
  return (
    <Screen title={t('mobile.management.debts')}>
      <Text style={primitiveStyles.section}>{t('mobile.management.liabilityAccount')}</Text>
      {accounts.map((account) => <Pressable key={account.id} accessibilityRole="radio" accessibilityState={{ selected: accountId === account.id }} onPress={() => { selectionHaptic(); setAccountId(account.id); }} style={[styles.account, accountId === account.id && styles.selected]}><Text style={styles.accountText}>{account.name}</Text></Pressable>)}
      {!accounts.length ? <Empty>{t('mobile.management.createLiabilityFirst')}</Empty> : null}
      <Field label={t('mobile.management.principal', { currency: workspaceCurrency })} value={principal} onChangeText={setPrincipal} keyboardType="decimal-pad" />
      <Field label={t('mobile.management.annualRate')} value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
      <Field label={t('mobile.management.minimumPayment', { currency: workspaceCurrency })} value={minimum} onChangeText={setMinimum} keyboardType="decimal-pad" />
      <Field label={t('mobile.management.dueDay')} value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" />
      <Button label={t('mobile.management.saveDebt')} onPress={() => void save()} busy={busy} disabled={!accountId || !principal} />
      {error ? <Notice error>{error}</Notice> : null}
      {debts.map((debt) => <Card key={debt.ledger_account_id}><View style={primitiveStyles.between}><Text style={primitiveStyles.cardTitle}>{debt.name}</Text><Text style={primitiveStyles.cardTitle}>{debt.outstanding_minor} {debt.currency_code}</Text></View><Text style={primitiveStyles.secondary}>{debt.principal_minor} · {debt.annual_rate_bps === null ? '—' : `${debt.annual_rate_bps / 100}% APR`}</Text><Button label={`${t('mobile.management.remove')} ${debt.name}`} destructive onPress={() => Alert.alert(t('mobile.management.remove'), debt.name, [{ text: t('mobile.common.cancel'), style: 'cancel' }, { text: t('mobile.management.remove'), style: 'destructive', onPress: () => void remove(debt) }])} /></Card>)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: { minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: Radius.md, paddingHorizontal: Spacing.md },
  selected: { borderColor: Colors.accent, backgroundColor: Colors.accentLight },
  accountText: { ...Typography.body },
});
