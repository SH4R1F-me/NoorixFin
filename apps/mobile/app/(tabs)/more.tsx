/**
 * More tab — accounts list, reports link, and settings hub.
 */
import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  SafeAreaView, RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatAmount, getCurrency } from '@noorixfin/money';
import { listAccounts, type AccountRow } from '../../src/repositories/accounts';
import { useWorkspace } from '../../src/lib/WorkspaceContext';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../src/lib/theme';
import {
  Wallet, BarChart2, Settings, ChevronRight,
  ShieldCheck, Database, Bell, LogOut, User,
} from 'lucide-react-native';

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function MenuItem({
  icon: Icon, label, subtitle, onPress, color,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.menuItem}>
      <View style={[styles.menuIcon, { backgroundColor: `${color ?? Colors.accent}20` }]}>
        <Icon size={18} color={color ?? Colors.accent} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, color ? { color } : {}]}>{label}</Text>
        {subtitle && <Text style={styles.menuSub}>{subtitle}</Text>}
      </View>
      <ChevronRight size={16} color={Colors.textFaint} strokeWidth={2} />
    </TouchableOpacity>
  );
}

export default function MoreScreen() {
  const { workspaceId, workspaceName } = useWorkspace();
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!workspaceId) { setLoading(false); return; }
    if (!isRefresh) setLoading(true);
    setAccounts(await listAccounts(workspaceId));
    setLoading(false);
    setRefreshing(false);
  }, [workspaceId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const onRefresh = useCallback(() => { setRefreshing(true); void load(true); }, [load]);

  const accountsByClass = accounts.reduce<Record<string, AccountRow[]>>(
    (acc, a) => { (acc[a.class] = acc[a.class] ?? []).push(a); return acc; },
    {},
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        {/* Workspace header */}
        <View style={styles.wsHeader}>
          <View style={styles.wsIcon}>
            <Text style={styles.wsIconText}>{(workspaceName || 'W').charAt(0)}</Text>
          </View>
          <View>
            <Text style={styles.wsLabel}>Workspace</Text>
            <Text style={styles.wsName}>{workspaceName || 'My Workspace'}</Text>
          </View>
        </View>

        {/* Accounts */}
        <SectionHeader title="Accounts" />
        {loading ? (
          [1, 2, 3].map((i) => <View key={i} style={styles.accountSkeleton} />)
        ) : accounts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No accounts found.</Text>
          </View>
        ) : (
          Object.entries(accountsByClass).map(([cls, accts]) => (
            <View key={cls} style={styles.accountGroup}>
              <Text style={styles.accountClass}>{cls}</Text>
              {accts.map((acct) => {
                const sym = getCurrency(acct.currency_code).symbol;
                const bal = `${sym}${formatAmount(Math.abs(acct.balance_minor), acct.currency_code, 'en')}`;
                const isNeg = acct.balance_minor < 0;
                return (
                  <View key={acct.id} style={styles.accountRow}>
                    <View style={styles.accountDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accountName}>{acct.name}</Text>
                      <Text style={styles.accountSubtype}>{acct.subtype}</Text>
                    </View>
                    <Text style={[styles.accountBal, { color: isNeg ? Colors.error : Colors.text }]}>
                      {isNeg ? '-' : ''}{bal}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))
        )}

        {/* Reports */}
        <SectionHeader title="Reports" />
        <View style={styles.menuGroup}>
          <MenuItem
            icon={BarChart2}
            label="Category Report"
            subtitle="Spending by category"
            onPress={() => {}}
          />
        </View>

        {/* Settings */}
        <SectionHeader title="Settings" />
        <View style={styles.menuGroup}>
          <MenuItem icon={User} label="Profile" onPress={() => router.push('/settings/profile')} />
          <MenuItem icon={Bell} label="Notifications" onPress={() => router.push('/settings/notifications')} />
          <MenuItem icon={ShieldCheck} label="Security" onPress={() => router.push('/settings/security')} />
          <MenuItem icon={Database} label="Data & Privacy" onPress={() => router.push('/settings/data')} />
          <MenuItem icon={Settings} label="Preferences" onPress={() => router.push('/settings/preferences')} />
        </View>

        <View style={[styles.menuGroup, { marginTop: Spacing.sm }]}>
          <MenuItem
            icon={LogOut}
            label="Sign Out"
            color={Colors.error}
            onPress={() => router.push('/settings/sign-out')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },

  wsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  wsIcon: {
    width: 44, height: 44, borderRadius: Radius.sm,
    backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center',
  },
  wsIconText: { fontSize: 20, fontWeight: '800', color: Colors.accent },
  wsLabel: { ...Typography.caption },
  wsName: { ...Typography.body, fontWeight: '700', marginTop: 2 },

  sectionTitle: { ...Typography.label, marginBottom: Spacing.sm, marginTop: Spacing.md },

  accountGroup: { marginBottom: Spacing.xs },
  accountClass: { fontSize: 10, fontWeight: '700', color: Colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  accountRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs, borderWidth: 1, borderColor: Colors.border,
  },
  accountDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  accountName: { ...Typography.body, fontWeight: '600' },
  accountSubtype: { ...Typography.caption, marginTop: 1, textTransform: 'capitalize' },
  accountBal: { ...Typography.amount },
  accountSkeleton: {
    height: 52, backgroundColor: Colors.bgCard, borderRadius: Radius.md, marginBottom: Spacing.xs,
  },

  menuGroup: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  menuIcon: { width: 34, height: 34, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { ...Typography.body, fontWeight: '500' },
  menuSub: { ...Typography.caption, marginTop: 1 },

  emptyCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.xl, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  emptyText: { ...Typography.bodyDim },
});
