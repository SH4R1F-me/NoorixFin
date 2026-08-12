/**
 * Transactions tab — full list with search, filter, and swipe-to-refresh.
 * Reads from local SQLite (offline-first). Pull-to-refresh triggers a real sync.
 */
import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { formatAmount, getCurrency } from '@noorixfin/money';
import { listRecent, type TransactionRow } from '../../src/repositories/transactions';
import { useSyncTriggers } from '../../src/sync/useSyncTriggers';
import { useWorkspace } from '../../src/lib/WorkspaceContext';
import { TransactionListSkeleton } from '../../src/components/Skeleton';
import { Colors, Typography, Spacing, Radius } from '../../src/lib/theme';
import { Search, ArrowLeftRight } from 'lucide-react-native';

type FilterType = '' | 'INCOME' | 'EXPENSE' | 'TRANSFER';

const FILTERS: { label: string; value: FilterType }[] = [
  { label: 'All', value: '' },
  { label: 'Income', value: 'INCOME' },
  { label: 'Expense', value: 'EXPENSE' },
  { label: 'Transfer', value: 'TRANSFER' },
];

const STATUS_COLOR: Record<string, string> = {
  IDLE: Colors.ok, SYNCING: Colors.info, OFFLINE: Colors.warn,
  NEEDS_ATTENTION: Colors.error, ERROR: Colors.error,
};

export default function TransactionsScreen() {
  const { workspaceId } = useWorkspace();
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [filtered, setFiltered] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('');
  const { state, pending, syncNow } = useSyncTriggers(workspaceId || null);

  const load = useCallback(async () => {
    if (!workspaceId) { setLoading(false); return; }
    setRows(await listRecent(workspaceId, 200));
    setLoading(false);
  }, [workspaceId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // Filter and search in memory (SQLite data is already local)
  const applyFilters = useCallback(
    (all: TransactionRow[], q: string, type: FilterType) => {
      let result = all;
      if (type) result = result.filter((r) => r.entry_type === type);
      if (q.trim()) {
        const lower = q.toLowerCase();
        result = result.filter(
          (r) => r.payee?.toLowerCase().includes(lower) || r.note?.toLowerCase().includes(lower),
        );
      }
      setFiltered(result);
    },
    [],
  );

  const handleSearch = (q: string) => { setSearch(q); applyFilters(rows, q, filterType); };
  const handleFilter = (t: FilterType) => { setFilterType(t); applyFilters(rows, search, t); };

  const onRefresh = useCallback(async () => {
    if (!workspaceId) return;
    await syncNow();
    await load();
    applyFilters(rows, search, filterType);
  }, [syncNow, load, rows, search, filterType, workspaceId, applyFilters]);

  const displayRows = search || filterType ? filtered : rows;

  const renderItem = useCallback(({ item }: { item: TransactionRow }) => {
    const sym = getCurrency(item.currency_code).symbol;
    const amount = `${sym}${formatAmount(item.amount_minor, item.currency_code, 'en')}`;
    const isIncome = item.entry_type === 'INCOME';

    return (
      <View style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: isIncome ? 'rgba(16,185,129,0.15)' : 'rgba(248,250,252,0.06)' }]}>
          <Text style={{ fontSize: 14, color: isIncome ? Colors.income : Colors.textDim }}>
            {isIncome ? '↑' : item.entry_type === 'TRANSFER' ? '⇄' : '↓'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.payee} numberOfLines={1}>{item.payee ?? item.entry_type}</Text>
          {item.note ? <Text style={styles.note} numberOfLines={1}>{item.note}</Text> : null}
          <Text style={styles.date}>{item.local_date}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.amount, { color: isIncome ? Colors.income : Colors.text }]}>
            {isIncome ? '+' : ''}{amount}
          </Text>
          {item.is_pending === 1 && <Text style={styles.pending}>pending</Text>}
        </View>
      </View>
    );
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm }}>
          <ArrowLeftRight size={20} color={Colors.accent} strokeWidth={2} />
          <Text style={styles.title}>Transactions</Text>
        </View>
        {/* Sync status */}
        <View style={styles.syncRow}>
          <View style={[styles.dot, { backgroundColor: STATUS_COLOR[state] ?? Colors.textFaint }]} />
          <Text style={styles.syncText}>
            {state === 'IDLE' ? 'Synced' : state === 'SYNCING' ? 'Syncing…' : state === 'OFFLINE' ? 'Offline' : state}
            {pending > 0 ? ` · ${pending} pending` : ''}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Search size={16} color={Colors.textFaint} style={{ marginLeft: Spacing.sm }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by payee or note…"
          placeholderTextColor={Colors.textFaint}
          value={search}
          onChangeText={handleSearch}
          returnKeyType="search"
        />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map(({ label, value }) => (
          <TouchableOpacity
            key={value}
            onPress={() => handleFilter(value)}
            style={[styles.chip, filterType === value && styles.chipActive]}
          >
            <Text style={[styles.chipText, filterType === value && styles.chipTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <TransactionListSkeleton />
      ) : (
        <FlatList
          data={displayRows}
          keyExtractor={(item) => item.id}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={state === 'SYNCING'}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {search || filterType ? 'No matching transactions.' : 'No transactions yet. Tap + to add one.'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: Spacing.xxl }}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  title: { ...Typography.h2 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  syncText: { fontSize: 12, color: Colors.textFaint },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: {
    flex: 1, padding: Spacing.sm, color: Colors.text,
    fontSize: 14,
  },

  filterRow: {
    flexDirection: 'row', gap: Spacing.xs,
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { fontSize: 12, color: Colors.textDim, fontWeight: '500' },
  chipTextActive: { color: '#000', fontWeight: '700' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  payee: { ...Typography.body, fontWeight: '600' },
  note: { ...Typography.caption, marginTop: 1 },
  date: { ...Typography.caption, marginTop: 1 },
  amount: { ...Typography.amount },
  pending: { fontSize: 10, color: Colors.warn, marginTop: 2 },

  emptyBox: { alignItems: 'center', paddingTop: Spacing.xxl, paddingHorizontal: Spacing.xl },
  emptyText: { ...Typography.bodyDim, textAlign: 'center' },
});
