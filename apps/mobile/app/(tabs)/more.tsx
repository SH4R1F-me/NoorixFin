/**
 * More tab — accounts list, reports link, and settings hub.
 */
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatAmount, getCurrency } from '@noorixfin/money';
import { listAccounts, type AccountRow } from '../../src/repositories/accounts';
import { useWorkspace } from '../../src/lib/WorkspaceContext';
import { Colors, Typography, Spacing, Radius } from '../../src/lib/theme';
import {
  Wallet,
  BarChart2,
  Settings,
  ChevronRight,
  ShieldCheck,
  Database,
  Bell,
  LogOut,
  User,
  AlertTriangle,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { isSupportedLocale, type SupportedLanguage } from '@noorixfin/i18n';

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function MenuItem({
  icon: Icon,
  label,
  subtitle,
  onPress,
  color,
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
  const { t, i18n } = useTranslation();
  const locale: SupportedLanguage = isSupportedLocale(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : 'bn';
  const { workspaceId, workspaceName } = useWorkspace();
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }
      if (!isRefresh) setLoading(true);
      setAccounts(await listAccounts(workspaceId));
      setLoading(false);
      setRefreshing(false);
    },
    [workspaceId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(true);
  }, [load]);

  const accountsByClass = accounts.reduce<Record<string, AccountRow[]>>((acc, a) => {
    (acc[a.class] = acc[a.class] ?? []).push(a);
    return acc;
  }, {});

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
            <Text style={styles.wsLabel}>{t('workspace.personal')}</Text>
            <Text style={styles.wsName}>{workspaceName || 'My Workspace'}</Text>
          </View>
        </View>

        {/* Accounts */}
        <View style={styles.sectionHeadingRow}>
          <SectionHeader title={t('accounts.title')} />
          <TouchableOpacity
            accessibilityRole="link"
            accessibilityLabel="Manage accounts"
            onPress={() => router.push('/accounts')}
            style={styles.manageLink}
          >
            <Text style={styles.manageLinkText}>{t('mobile.management.manage')}</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          [1, 2, 3].map((i) => <View key={i} style={styles.accountSkeleton} />)
        ) : accounts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('accounts.noAccounts')}</Text>
          </View>
        ) : (
          Object.entries(accountsByClass).map(([cls, accts]) => (
            <View key={cls} style={styles.accountGroup}>
              <Text style={styles.accountClass}>{cls}</Text>
              {accts.map((acct) => {
                const sym = getCurrency(acct.currency_code).symbol;
                const bal = `${sym}${formatAmount(Math.abs(acct.balance_minor), acct.currency_code, locale)}`;
                const isNeg = acct.balance_minor < 0;
                return (
                  <View key={acct.id} style={styles.accountRow}>
                    <View style={styles.accountDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accountName}>{acct.name}</Text>
                      <Text style={styles.accountSubtype}>{acct.subtype}</Text>
                    </View>
                    <Text
                      style={[styles.accountBal, { color: isNeg ? Colors.error : Colors.text }]}
                    >
                      {isNeg ? '-' : ''}
                      {bal}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))
        )}

        {/* Reports */}
        <SectionHeader title={t('reports.title')} />
        <View style={styles.menuGroup}>
          <MenuItem
            icon={BarChart2}
            label={t('reports.categoryBreakdown')}
            subtitle={t('reports.subtitle')}
            onPress={() => router.push('/reports')}
          />
          <MenuItem
            icon={Wallet}
            label={t('debts.title')}
            subtitle={t('debts.subtitle')}
            onPress={() => router.push('/debts')}
          />
        </View>

        {/* Settings */}
        <SectionHeader title={t('settings.title')} />
        <View style={styles.menuGroup}>
          <MenuItem
            icon={AlertTriangle}
            label={t('mobile.sync.issues')}
            subtitle={t('mobile.sync.reviewRejected')}
            onPress={() => router.push('/sync-issues')}
          />
          <MenuItem icon={User} label={t('settings.profile')} onPress={() => router.push('/settings/profile')} />
          <MenuItem
            icon={Bell}
            label={t('settings.notifications')}
            subtitle="Inbox and delivery settings"
            onPress={() => router.push('/notifications')}
          />
          <MenuItem
            icon={ShieldCheck}
            label={t('settings.security')}
            onPress={() => router.push('/settings/security')}
          />
          <MenuItem
            icon={Database}
            label={`${t('settings.exportData')} / ${t('settings.privacy')}`}
            onPress={() => router.push('/settings/data')}
          />
          <MenuItem
            icon={Settings}
            label={t('settings.preferences')}
            onPress={() => router.push('/settings/preferences')}
          />
        </View>

        <View style={[styles.menuGroup, { marginTop: Spacing.sm }]}>
          <MenuItem
            icon={LogOut}
            label={t('auth.signOut')}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  wsIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wsIconText: { fontSize: 20, fontWeight: '800', color: Colors.accent },
  wsLabel: { ...Typography.caption },
  wsName: { ...Typography.body, fontWeight: '700', marginTop: 2 },

  sectionTitle: { ...Typography.label, marginBottom: Spacing.sm, marginTop: Spacing.md },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  manageLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.sm, marginTop: Spacing.sm },
  manageLinkText: { ...Typography.caption, color: Colors.accent, fontWeight: '700' },

  accountGroup: { marginBottom: Spacing.xs },
  accountClass: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accountDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  accountName: { ...Typography.body, fontWeight: '600' },
  accountSubtype: { ...Typography.caption, marginTop: 1, textTransform: 'capitalize' },
  accountBal: { ...Typography.amount },
  accountSkeleton: {
    height: 52,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    marginBottom: Spacing.xs,
  },

  menuGroup: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { ...Typography.body, fontWeight: '500' },
  menuSub: { ...Typography.caption, marginTop: 1 },

  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  emptyText: { ...Typography.bodyDim },
});
