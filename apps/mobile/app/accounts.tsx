import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { majorStringToMinorUnits } from '@noorixfin/money';
import { apiFetch } from '../src/lib/api';
import { useWorkspace } from '../src/lib/WorkspaceContext';
import { sync } from '../src/sync/engine';
import { confirmHaptic, selectionHaptic } from '../src/lib/haptics';
import {
  Button,
  Card,
  Choice,
  Empty,
  Field,
  Notice,
  Screen,
  primitiveStyles,
} from '../src/components/ScreenPrimitives';
import { Colors, Radius, Spacing, Typography } from '../src/lib/theme';
import { useTranslation } from 'react-i18next';

type AccountClass = 'ASSET' | 'LIABILITY';
type Subtype = 'CASH' | 'BANK' | 'MOBILE_WALLET' | 'CREDIT_CARD' | 'LOAN' | 'SAVINGS';
type Account = {
  id: string;
  name: string;
  class: string;
  subtype: string;
  currency_code: string;
  archived_at?: string | null;
};

export default function AccountsScreen() {
  const { workspaceId, workspaceCurrency } = useWorkspace();
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState('');
  const [opening, setOpening] = useState('0');
  const [accountClass, setAccountClass] = useState<AccountClass>('ASSET');
  const [subtype, setSubtype] = useState<Subtype>('BANK');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setAccounts(await apiFetch(`/workspaces/${workspaceId}/accounts`) as Account[]);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load accounts');
    }
  }, [workspaceId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const create = async () => {
    if (!workspaceId || !name.trim()) return;
    setBusy(true);
    try {
      const minor = majorStringToMinorUnits(opening || '0', workspaceCurrency);
      await apiFetch(`/workspaces/${workspaceId}/accounts`, {
        method: 'POST',
        body: {
          name: name.trim(),
          class: accountClass,
          subtype,
          currency_code: workspaceCurrency,
          normal_balance: accountClass === 'LIABILITY' ? 'CREDIT' : 'DEBIT',
          include_in_budget: accountClass === 'ASSET',
          include_in_net_worth: true,
          opening_balance: String(minor),
        },
      });
      setName('');
      setOpening('0');
      await sync(workspaceId);
      await load();
      confirmHaptic();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create account');
    } finally {
      setBusy(false);
    }
  };

  const rename = async (account: Account) => {
    if (!workspaceId || !editingName.trim()) return;
    await apiFetch(`/workspaces/${workspaceId}/accounts/${account.id}`, {
      method: 'PATCH',
      body: { name: editingName.trim() },
    });
    setEditingId(null);
    setEditingName('');
    await load();
    confirmHaptic();
  };

  const archive = (account: Account) => {
    if (!workspaceId) return;
    Alert.alert('Archive account?', 'Historical ledger entries remain intact.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: () => void (async () => {
          await apiFetch(`/workspaces/${workspaceId}/accounts/${account.id}`, {
            method: 'PATCH',
            body: { archived: true },
          });
          await sync(workspaceId);
          await load();
          confirmHaptic();
        })(),
      },
    ]);
  };

  return (
    <Screen title={t('mobile.management.accounts')}>
      <Field label={t('mobile.management.accountName')} value={name} onChangeText={setName} />
      <Choice label={t('mobile.management.accountClass')} value={accountClass} options={['ASSET', 'LIABILITY']} onChange={(value) => { selectionHaptic(); setAccountClass(value); }} />
      <Choice label={t('mobile.management.accountType')} value={subtype} options={['CASH', 'BANK', 'MOBILE_WALLET', 'CREDIT_CARD', 'LOAN', 'SAVINGS']} onChange={(value) => { selectionHaptic(); setSubtype(value); }} />
      <Field label={t('mobile.management.openingBalance', { currency: workspaceCurrency })} value={opening} onChangeText={setOpening} keyboardType="decimal-pad" />
      <Button label={t('mobile.management.createAccount')} onPress={() => void create()} busy={busy} disabled={!name.trim()} />
      {error ? <Notice error>{error}</Notice> : null}

      <Text style={primitiveStyles.section}>{t('mobile.management.activeAccounts')}</Text>
      {accounts.filter((account) => !account.archived_at).length === 0 ? <Empty>{t('mobile.management.noActiveAccounts')}</Empty> : null}
      {accounts.filter((account) => !account.archived_at).map((account) => (
        <Card key={account.id}>
          {editingId === account.id ? (
            <>
              <Field label={t('mobile.management.newAccountName')} value={editingName} onChangeText={setEditingName} autoFocus />
              <Button label={t('mobile.management.save')} onPress={() => void rename(account)} disabled={!editingName.trim()} />
            </>
          ) : null}
          <View style={primitiveStyles.between}>
            <View style={{ flex: 1 }}>
              <Text style={primitiveStyles.cardTitle}>{account.name}</Text>
              <Text style={primitiveStyles.secondary}>{account.class} · {account.subtype} · {account.currency_code}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('mobile.management.renameNamed', { name: account.name })} onPress={() => { setEditingId(account.id); setEditingName(account.name); }} style={styles.smallButton}>
              <Text style={styles.smallText}>{t('mobile.management.rename')}</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('mobile.management.archiveNamed', { name: account.name })} onPress={() => archive(account)} style={styles.archiveButton}>
            <Text style={styles.archiveText}>{t('mobile.management.archive')}</Text>
          </Pressable>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  smallButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.borderStrong },
  smallText: { ...Typography.caption, color: Colors.accent },
  archiveButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  archiveText: { ...Typography.caption, color: Colors.error, fontWeight: '700' },
});
