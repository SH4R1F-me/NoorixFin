import { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  Bell,
  CheckCheck,
  ChevronRight,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react-native';
import { Colors, Radius, Shadow, Spacing, Typography } from '../src/lib/theme';
import {
  listLocalNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from '../src/repositories/notifications';
import { useWorkspace } from '../src/lib/WorkspaceContext';
import { sync } from '../src/sync/engine';

const severityColor: Record<string, string> = {
  INFO: Colors.info,
  SUCCESS: Colors.ok,
  WARNING: Colors.warn,
  CRITICAL: Colors.error,
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => setRows(await listLocalNotifications()), []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    if (workspaceId) await sync(workspaceId);
    await load();
    setRefreshing(false);
  }, [load, workspaceId]);

  const unread = rows.filter((row) => !row.read_at).length;

  async function read(row: NotificationRow) {
    if (!row.read_at) {
      if (!workspaceId) return;
      await markNotificationRead(row.id, workspaceId);
      await load();
      await Notifications.setBadgeCountAsync(Math.max(0, unread - 1));
    }
    if (row.action_url) {
      const path = mobilePathForAction(row.action_url);
      if (path) router.push(path as never);
    }
  }

  async function readAll() {
    if (!workspaceId) return;
    await markAllNotificationsRead(workspaceId);
    await Notifications.setBadgeCountAsync(0);
    await load();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>INBOX</Text>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>{unread ? `${unread} unread` : 'All caught up'}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            accessibilityLabel="Notification settings"
            style={styles.iconButton}
            onPress={() => router.push('/settings/notifications')}
          >
            <SlidersHorizontal size={18} color={Colors.textDim} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Mark all notifications read"
            disabled={!unread}
            style={[styles.iconButton, !unread && styles.disabled]}
            onPress={() => void readAll()}
          >
            <CheckCheck size={18} color={Colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, rows.length === 0 && styles.emptyList]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={Colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Bell size={36} color={Colors.textFaint} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Nothing here</Text>
            <Text style={styles.emptyBody}>
              Pull to refresh. Notifications remain available here even if a push cannot be
              delivered.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => void read(item)}
            style={[styles.card, !item.read_at && styles.unreadCard]}
          >
            <View
              style={[
                styles.notificationIcon,
                { borderColor: severityColor[item.severity] ?? Colors.info },
              ]}
            >
              {item.category === 'security' ? (
                <ShieldCheck size={18} color={severityColor[item.severity] ?? Colors.info} />
              ) : (
                <Bell size={18} color={severityColor[item.severity] ?? Colors.info} />
              )}
            </View>
            <View style={styles.cardContent}>
              <View style={styles.metaRow}>
                <Text
                  style={[styles.category, { color: severityColor[item.severity] ?? Colors.info }]}
                >
                  {item.category.toUpperCase()}
                </Text>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
                {!item.read_at && <View accessibilityLabel="Unread" style={styles.dot} />}
              </View>
              <Text style={styles.cardTitle}>{item.title_en}</Text>
              <Text style={styles.body} numberOfLines={3}>
                {item.body_en}
              </Text>
            </View>
            {item.action_url && <ChevronRight size={16} color={Colors.textFaint} />}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  eyebrow: { ...Typography.caption, color: Colors.accent, fontWeight: '800', letterSpacing: 1.5 },
  title: { ...Typography.h2, marginTop: 2 },
  subtitle: { ...Typography.caption, marginTop: 3 },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  emptyList: { flexGrow: 1 },
  card: {
    ...Shadow.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unreadCard: { borderColor: Colors.accent, backgroundColor: Colors.accentLight },
  notificationIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  category: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  date: { ...Typography.caption, marginLeft: 'auto', fontSize: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },
  cardTitle: { ...Typography.body, fontWeight: '700', marginTop: 4 },
  body: { ...Typography.bodyDim, fontSize: 12, lineHeight: 18, marginTop: 3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyTitle: { ...Typography.h3, marginTop: Spacing.md },
  emptyBody: { ...Typography.bodyDim, textAlign: 'center', marginTop: Spacing.xs, lineHeight: 20 },
});

function mobilePathForAction(value: string): string | null {
  if (value.startsWith('/admin') || /^https?:\/\//i.test(value)) return null;
  if (value.startsWith('/dashboard/notifications')) return '/notifications';
  if (value.startsWith('/dashboard/transactions')) return '/(tabs)/transactions';
  if (/^\/dashboard\/(budgets|goals|calendar)/.test(value)) return '/(tabs)/plan';
  if (value.startsWith('/dashboard/settings/notifications')) return '/settings/notifications';
  if (value.startsWith('/dashboard/settings/sessions')) return '/settings/security';
  if (value.startsWith('/dashboard/settings')) return '/(tabs)/more';
  return '/(tabs)';
}
