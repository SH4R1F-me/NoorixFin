/**
 * Home tab — net worth, this-month spend, budget rings, recent activity, sync status.
 */
import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { formatAmount, getCurrency } from '@noorixfin/money';
import { listRecent } from '../../src/repositories/transactions';
import { getNetWorth } from '../../src/repositories/accounts';
import { useSyncTriggers } from '../../src/sync/useSyncTriggers';
import { useWorkspace } from '../../src/lib/WorkspaceContext';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../src/lib/theme';

const STATUS_COLOR: Record<string, string> = {
  IDLE: Colors.ok,
  SYNCING: Colors.info,
  OFFLINE: Colors.warn,
  NEEDS_ATTENTION: Colors.error,
  ERROR: Colors.error,
};

const STATUS_LABEL: Record<string, string> = {
  IDLE: 'Synced',
  SYNCING: 'Syncing…',
  OFFLINE: 'Offline — changes saved locally',
  NEEDS_ATTENTION: 'Some changes need attention',
  ERROR: 'Sync failed',
};

export default function HomeScreen() {
  const { workspaceId, workspaceName } = useWorkspace();
  const [netWorth, setNetWorth] = useState({ net_worth_minor: 0, currency_code: 'BDT' });
  const [recentTxns, setRecentTxns] = useState<Awaited<ReturnType<typeof listRecent>>>([]);
  const [loading, setLoading] = useState(true);
  const { state, pending, syncNow } = useSyncTriggers(workspaceId || null);

  const load = useCallback(async () => {
    if (!workspaceId) { setLoading(false); return; }
    const [nw, txns] = await Promise.all([
      getNetWorth(workspaceId),
      listRecent(workspaceId, 5),
    ]);
    setNetWorth(nw);
    setRecentTxns(txns);
    setLoading(false);
  }, [workspaceId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const onRefresh = useCallback(async () => {
    if (!workspaceId) return;
    await syncNow();
    await load();
  }, [syncNow, load, workspaceId]);

  const currency = getCurrency(netWorth.currency_code);
  const netWorthFormatted = `${currency.symbol}${formatAmount(netWorth.net_worth_minor, netWorth.currency_code, 'en')}`;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={state === 'SYNCING'}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good day 👋</Text>
            <Text style={styles.workspaceName}>{workspaceName || 'My Workspace'}</Text>
          </View>
          {/* Sync indicator */}
          <View style={styles.syncBadge}>
            <View style={[styles.syncDot, { backgroundColor: STATUS_COLOR[state] ?? Colors.textFaint }]} />
            <Text style={styles.syncText}>
              {STATUS_LABEL[state] ?? state}
              {pending > 0 ? ` · ${pending}` : ''}
            </Text>
          </View>
        </View>

        {/* Net Worth Card */}
        <View style={[styles.netWorthCard, Shadow.card]}>
          <Text style={styles.netWorthLabel}>Net Worth</Text>
          {loading ? (
            <View style={styles.skeleton} />
          ) : (
            <Text style={styles.netWorthAmount}>{netWorthFormatted}</Text>
          )}
          <Text style={styles.netWorthSub}>Across all accounts</Text>
        </View>

        {/* Offline warning banner */}
        {state === 'OFFLINE' && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>
              📶 Offline — {pending > 0 ? `${pending} changes waiting to sync` : 'No pending changes'}
            </Text>
          </View>
        )}

        {state === 'NEEDS_ATTENTION' && (
          <View style={[styles.offlineBanner, { borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)' }]}>
            <Text style={[styles.offlineText, { color: Colors.error }]}>
              ⚠️ Some changes need your attention. Check the Transactions tab.
            </Text>
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {loading ? (
            [1, 2, 3].map((i) => <View key={i} style={styles.txnSkeleton} />)
          ) : recentTxns.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No transactions yet.</Text>
              <Text style={styles.emptySubtext}>Tap + to add your first one.</Text>
            </View>
          ) : (
            recentTxns.map((txn) => {
              const sym = getCurrency(txn.currency_code).symbol;
              const amountStr = `${sym}${formatAmount(txn.amount_minor, txn.currency_code, 'en')}`;
              const isIncome = txn.entry_type === 'INCOME';
              return (
                <View key={txn.id} style={styles.txnRow}>
                  <View style={[styles.txnIcon, { backgroundColor: isIncome ? 'rgba(16,185,129,0.15)' : 'rgba(248,250,252,0.08)' }]}>
                    <Text style={{ fontSize: 16 }}>{isIncome ? '↑' : '↓'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txnPayee}>{txn.payee ?? txn.entry_type}</Text>
                    <Text style={styles.txnDate}>{txn.local_date}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.txnAmount, { color: isIncome ? Colors.income : Colors.text }]}>
                      {isIncome ? '+' : ''}{amountStr}
                    </Text>
                    {txn.is_pending === 1 && (
                      <Text style={styles.pendingBadge}>pending</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: Spacing.lg,
  },
  greeting: { ...Typography.caption, marginBottom: 2 },
  workspaceName: { ...Typography.h3 },
  syncBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.bgCard, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  syncDot: { width: 7, height: 7, borderRadius: 3.5 },
  syncText: { fontSize: 11, color: Colors.textDim, fontWeight: '500' },

  netWorthCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  netWorthLabel: { ...Typography.label, marginBottom: Spacing.sm },
  netWorthAmount: { fontSize: 36, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  netWorthSub: { ...Typography.caption },
  skeleton: { height: 36, width: 180, backgroundColor: Colors.bgElevated, borderRadius: Radius.sm },

  offlineBanner: {
    backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: Radius.md,
    padding: Spacing.sm, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
    marginBottom: Spacing.md,
  },
  offlineText: { fontSize: 13, color: Colors.warn, textAlign: 'center' },

  section: { marginTop: Spacing.md },
  sectionTitle: { ...Typography.label, marginBottom: Spacing.sm },

  txnRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: Colors.border,
  },
  txnIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txnPayee: { ...Typography.body, fontWeight: '600' },
  txnDate: { ...Typography.caption, marginTop: 1 },
  txnAmount: { ...Typography.amount },
  pendingBadge: { fontSize: 10, color: Colors.warn, marginTop: 2 },

  txnSkeleton: {
    height: 64, backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    marginBottom: Spacing.xs,
  },

  emptyBox: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyText: { ...Typography.body, fontWeight: '600', marginBottom: 4 },
  emptySubtext: { ...Typography.bodyDim },
});
