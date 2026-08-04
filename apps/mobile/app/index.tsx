/**
 * Transactions list — DEC-010, DEC-012.
 *
 * Renders from local SQLite, so it paints before any network call and behaves
 * identically offline. The sync status strip makes the queue visible: a user
 * who adds a transaction on a plane should be able to see that it is saved and
 * waiting, not wonder whether it was lost.
 */
import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { formatAmount, getCurrency } from '@noorixfin/money';
import { listRecent, type TransactionRow } from '../src/repositories/transactions';
import { useSyncTriggers } from '../src/sync/useSyncTriggers';
import { TransactionListSkeleton } from '../src/components/Skeleton';

// TODO(W4-followup): the active workspace should come from GET /v1/workspaces
// on first launch and be cached locally. Hardcoding it here keeps this screen
// honest about what is wired and what is not.
const WORKSPACE_ID = process.env.EXPO_PUBLIC_DEV_WORKSPACE_ID ?? '';

const STATUS_LABEL: Record<string, string> = {
  IDLE: 'Synced',
  SYNCING: 'Syncing…',
  OFFLINE: 'Offline — changes saved locally',
  NEEDS_ATTENTION: 'Some changes need your attention',
  ERROR: 'Sync failed',
};

const STATUS_COLOR: Record<string, string> = {
  IDLE: '#10b981',
  SYNCING: '#3b82f6',
  OFFLINE: '#f59e0b',
  NEEDS_ATTENTION: '#ef4444',
  ERROR: '#ef4444',
};

export default function TransactionsScreen() {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { state, pending, syncNow } = useSyncTriggers(WORKSPACE_ID || null);

  const load = useCallback(async () => {
    if (!WORKSPACE_ID) { setLoading(false); return; }
    setRows(await listRecent(WORKSPACE_ID));
    setLoading(false);
  }, []);

  // Reload from SQLite whenever the screen regains focus — the sync engine may
  // have written new rows while the user was elsewhere.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const onRefresh = useCallback(async () => {
    await syncNow();
    await load();
  }, [syncNow, load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: STATUS_COLOR[state] ?? '#64748b' }]} />
          <Text style={styles.status}>
            {STATUS_LABEL[state] ?? state}
            {pending > 0 ? ` · ${pending} pending` : ''}
          </Text>
        </View>
      </View>

      {loading ? (
        // Layout-matched skeleton, not a spinner (DEC-012): rows keep their
        // final dimensions so nothing shifts when the data lands.
        <TransactionListSkeleton />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          // FlatList virtualises by default; these bound the work per frame so
          // a long ledger stays smooth on a low-end device.
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={state === 'SYNCING'} onRefresh={onRefresh} tintColor="#10b981" />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {WORKSPACE_ID
                ? 'No transactions yet.'
                : 'Set EXPO_PUBLIC_DEV_WORKSPACE_ID to load a workspace.'}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.payee}>{item.payee ?? item.entry_type}</Text>
                <Text style={styles.date}>{item.local_date}</Text>
              </View>
              <View style={styles.rowAmount}>
                <Text
                  style={[
                    styles.amount,
                    { color: item.entry_type === 'INCOME' ? '#10b981' : '#f8fafc' },
                  ]}
                >
                  {getCurrency(item.currency_code).symbol}
                  {formatAmount(item.amount_minor, item.currency_code, 'en')}
                </Text>
                {/* Optimistic rows are labelled rather than hidden — the user
                    should know the difference between saved and confirmed. */}
                {item.is_pending === 1 ? <Text style={styles.pending}>pending</Text> : null}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', paddingTop: 60 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#f8fafc' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 13, color: '#94a3b8' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  rowMain: { flex: 1 },
  payee: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
  date: { fontSize: 12, color: '#64748b', marginTop: 2 },
  rowAmount: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '700' },
  pending: { fontSize: 11, color: '#f59e0b', marginTop: 2 },
});
