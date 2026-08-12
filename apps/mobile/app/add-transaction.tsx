/**
 * Add Transaction modal — amount-first entry (numeric pad → category → account → date → note).
 *
 * Following DEC-010: the transaction is written to SQLite optimistically first,
 * then enqueued for the API. The user sees immediate feedback and can go offline
 * immediately after tapping Save.
 *
 * The amount pad uses integer minor units — no floating-point arithmetic (DEC-004).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useWorkspace } from '../src/lib/WorkspaceContext';
import { listCategories, type CategoryRow } from '../src/repositories/categories';
import { listAccounts, type AccountRow } from '../src/repositories/accounts';
import { createTransaction } from '../src/repositories/transactions';
import { Colors, Typography, Spacing, Radius } from '../src/lib/theme';
import { X, ChevronDown, Check } from 'lucide-react-native';

type TxnType = 'EXPENSE' | 'INCOME' | 'TRANSFER';

const TYPE_LABELS: Record<TxnType, string> = {
  EXPENSE: 'Expense',
  INCOME: 'Income',
  TRANSFER: 'Transfer',
};

const DIGITS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'];

export default function AddTransactionModal() {
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const [type, setType] = useState<TxnType>('EXPENSE');
  const [amountStr, setAmountStr] = useState('0');
  const [note, setNote] = useState('');
  const [payee, setPayee] = useState('');
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'amount' | 'details'>('amount');

  useEffect(() => {
    if (!workspaceId) return;
    void Promise.all([
      listCategories(workspaceId, type === 'INCOME' ? 'INCOME' : 'EXPENSE'),
      listAccounts(workspaceId),
    ]).then(([cats, accts]) => {
      setCategories(cats);
      setAccounts(accts);
      if (!selectedAccount && accts[0]) setSelectedAccount(accts[0].id);
    });
  }, [workspaceId, type]);

  const handleDigit = useCallback((digit: string) => {
    if (digit === '⌫') {
      setAmountStr((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
      return;
    }
    setAmountStr((prev) => {
      if (prev === '0' && digit !== '.') return digit;
      if (digit === '.' && prev.includes('.')) return prev;
      if (prev.includes('.') && prev.split('.')[1]!.length >= 2) return prev;
      return prev + digit;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!workspaceId || !selectedAccount) return;
    const floatAmount = parseFloat(amountStr);
    if (!floatAmount || floatAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter an amount greater than 0.');
      return;
    }

    // Convert to minor units (2 decimal places)
    const amountMinorStr = String(Math.round(floatAmount * 100));

    setSaving(true);
    try {
      await createTransaction(workspaceId, {
        type,
        amount: amountMinorStr,
        account_id: selectedAccount,
        category_id: selectedCategory ?? undefined,
        payee: payee.trim() || undefined,
        note: note.trim() || undefined,
      });
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [workspaceId, selectedAccount, amountStr, type, selectedCategory, payee, note, router]);

  const displayAmount = amountStr.startsWith('0') && amountStr.length > 1 && !amountStr.startsWith('0.')
    ? amountStr.replace(/^0+/, '')
    : amountStr;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={20} color={Colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Transaction</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Type selector */}
      <View style={styles.typeRow}>
        {(Object.keys(TYPE_LABELS) as TxnType[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setType(t)}
            style={[styles.typeChip, type === t && styles.typeChipActive]}
          >
            <Text style={[styles.typeText, type === t && styles.typeTextActive]}>
              {TYPE_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {step === 'amount' ? (
        <>
          {/* Amount display */}
          <View style={styles.amountDisplay}>
            <Text style={styles.currencySymbol}>৳</Text>
            <Text style={styles.amountText}>{displayAmount}</Text>
          </View>

          {/* Numeric pad */}
          <View style={styles.pad}>
            {DIGITS.map((digit) => (
              <TouchableOpacity
                key={digit}
                onPress={() => handleDigit(digit)}
                style={[styles.padKey, digit === '⌫' && styles.padKeyBack]}
              >
                <Text style={[styles.padKeyText, digit === '⌫' && { fontSize: 20 }]}>
                  {digit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => setStep('details')}
            style={styles.nextBtn}
          >
            <Text style={styles.nextBtnText}>Continue →</Text>
          </TouchableOpacity>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.detailsContent}>
          {/* Amount summary */}
          <TouchableOpacity
            onPress={() => setStep('amount')}
            style={styles.amountSummary}
          >
            <Text style={styles.amountSummaryLabel}>Amount</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.amountSummaryValue}>৳{displayAmount}</Text>
              <ChevronDown size={16} color={Colors.accent} />
            </View>
          </TouchableOpacity>

          {/* Payee */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Payee / Description</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Grocery store, Salary…"
              placeholderTextColor={Colors.textFaint}
              value={payee}
              onChangeText={setPayee}
              returnKeyType="next"
            />
          </View>

          {/* Category */}
          {type !== 'TRANSFER' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {categories.map((cat) => {
                  const label = cat.custom_name ?? cat.translation_key ?? cat.id.slice(0, 8);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedCategory(cat.id)}
                      style={[styles.catChip, selectedCategory === cat.id && styles.catChipActive]}
                    >
                      {cat.icon && <Text>{cat.icon} </Text>}
                      <Text style={[styles.catChipText, selectedCategory === cat.id && { color: '#000' }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Account */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Account</Text>
            {accounts.map((acct) => (
              <TouchableOpacity
                key={acct.id}
                onPress={() => setSelectedAccount(acct.id)}
                style={[styles.acctRow, selectedAccount === acct.id && styles.acctRowActive]}
              >
                <View style={styles.acctDot} />
                <Text style={styles.acctName}>{acct.name}</Text>
                {selectedAccount === acct.id && <Check size={16} color={Colors.accent} strokeWidth={2.5} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Note */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput
              style={[styles.fieldInput, { minHeight: 72, textAlignVertical: 'top' }]}
              placeholder="Add a note…"
              placeholderTextColor={Colors.textFaint}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Save */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !selectedAccount}
            style={[styles.saveBtn, (saving || !selectedAccount) && styles.saveBtnDisabled]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save Transaction</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...Typography.h3 },

  typeRow: {
    flexDirection: 'row', gap: Spacing.xs,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    justifyContent: 'center',
  },
  typeChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
  },
  typeChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  typeText: { fontSize: 13, color: Colors.textDim, fontWeight: '600' },
  typeTextActive: { color: '#000' },

  amountDisplay: {
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  currencySymbol: { fontSize: 28, fontWeight: '800', color: Colors.textDim, marginTop: 8 },
  amountText: { fontSize: 52, fontWeight: '800', color: Colors.text },

  pad: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg, gap: Spacing.xs,
  },
  padKey: {
    width: '30%', aspectRatio: 2,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  padKeyBack: { backgroundColor: Colors.bgElevated },
  padKeyText: { fontSize: 22, fontWeight: '600', color: Colors.text },

  nextBtn: {
    marginHorizontal: Spacing.lg, marginTop: Spacing.lg,
    backgroundColor: Colors.accent, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center',
  },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  detailsContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  amountSummary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  amountSummaryLabel: { ...Typography.caption },
  amountSummaryValue: { fontSize: 20, fontWeight: '800', color: Colors.accent },

  fieldGroup: { gap: Spacing.xs },
  fieldLabel: { ...Typography.label },
  fieldInput: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: Spacing.md, color: Colors.text, fontSize: 15,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipScroll: { marginTop: 4 },
  catChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCard, marginRight: Spacing.xs,
  },
  catChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  catChipText: { fontSize: 13, color: Colors.textDim, fontWeight: '500' },

  acctRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: Spacing.sm + 2, borderWidth: 1, borderColor: Colors.border, marginBottom: 4,
  },
  acctRowActive: { borderColor: Colors.accent },
  acctDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  acctName: { ...Typography.body, flex: 1 },

  saveBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
