import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react-native';
import { useWorkspace } from '../src/lib/WorkspaceContext';
import {
  discard,
  listNeedingAttention,
  retry,
  type QueuedMutation,
} from '../src/sync/queue';
import { sync } from '../src/sync/engine';
import { Colors, Radius, Spacing, Typography } from '../src/lib/theme';

const KIND_LABELS: Record<QueuedMutation['kind'], string> = {
  CREATE_TRANSACTION: 'New transaction',
  REVERSE_TRANSACTION: 'Transaction reversal',
  READ_NOTIFICATION: 'Notification update',
  READ_ALL_NOTIFICATIONS: 'Notification updates',
};

export default function SyncIssuesScreen() {
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const [rows, setRows] = useState<QueuedMutation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setRows(await listNeedingAttention(workspaceId));
    setLoading(false);
  }, [workspaceId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function retryOne(id: string) {
    if (!workspaceId) return;
    setBusy(id);
    try {
      await retry(id);
      await sync(workspaceId);
      await load();
    } finally {
      setBusy(null);
    }
  }

  function discardOne(row: QueuedMutation) {
    Alert.alert(
      'Discard local change?',
      row.kind === 'CREATE_TRANSACTION'
        ? 'The rejected pending transaction will also be removed from this device.'
        : 'This rejected change will be removed from the queue.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setBusy(row.id);
            void discard(row.id)
              .then(load)
              .finally(() => setBusy(null));
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Sync issues</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>
      <View style={styles.explanation} accessibilityRole="summary">
        <AlertTriangle size={20} color={Colors.warn} />
        <Text style={styles.explanationText}>
          These changes were rejected by the server and need your decision. Nothing is silently
          merged or discarded.
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator style={styles.loader} color={Colors.accent} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No changes need attention.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{KIND_LABELS[item.kind]}</Text>
              <Text style={styles.meta}>
                {new Date(item.created_at).toLocaleString()} · {item.attempts} attempts
              </Text>
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {item.last_error ?? 'The server rejected this change.'}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy === item.id}
                  onPress={() => void retryOne(item.id)}
                  style={styles.retryButton}
                >
                  {busy === item.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <RotateCcw size={17} color="#fff" />
                  )}
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Discard ${KIND_LABELS[item.kind]}`}
                  disabled={busy === item.id}
                  onPress={() => discardOne(item)}
                  style={styles.discardButton}
                >
                  <Trash2 size={17} color={Colors.error} />
                  <Text style={styles.discardText}>Discard</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { ...Typography.h2 },
  done: { ...Typography.body, color: Colors.accent, fontWeight: '700' },
  explanation: {
    flexDirection: 'row',
    gap: Spacing.sm,
    margin: Spacing.lg,
    marginBottom: 0,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  explanationText: { ...Typography.caption, flex: 1, lineHeight: 18 },
  loader: { marginTop: Spacing.xl },
  list: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },
  empty: { ...Typography.bodyDim, textAlign: 'center', marginTop: Spacing.xl },
  card: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: { ...Typography.body, fontWeight: '700' },
  meta: { ...Typography.caption },
  error: { ...Typography.caption, color: Colors.error, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  retryButton: {
    minHeight: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
  },
  retryText: { ...Typography.body, color: '#fff', fontWeight: '700' },
  discardButton: {
    minHeight: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  discardText: { ...Typography.body, color: Colors.error, fontWeight: '700' },
});
