/**
 * Plan tab — budgets, goals, recurring rules, calendar events.
 * Fetches from API (no local SQLite tables for these yet).
 */
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiFetch } from '../../src/lib/api';
import { useWorkspace } from '../../src/lib/WorkspaceContext';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../src/lib/theme';
import { BarChart3, Target, Repeat2, Calendar } from 'lucide-react-native';

interface BudgetStatus {
  visible: boolean;
  has_budget: boolean;
  budget_id?: string;
  name: string;
  cadence: string;
  planned_total: number;
  spent_total: number;
  lines: Array<{
    line_id: string;
    name: string;
    planned_minor: number;
    spent_minor: number;
  }>;
}

interface Goal {
  id: string;
  name: string;
  target_minor: number;
  current_minor: number | null;
  currency_code: string;
  target_date: string | null;
}

interface PlanData {
  budget: BudgetStatus | null;
  goals: Goal[];
}

interface GoalsOverview {
  visible: boolean;
  goals: Goal[];
}

export default function PlanScreen() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const [data, setData] = useState<PlanData>({ budget: null, goals: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        const [budgetRes, goalRes] = await Promise.all([
          apiFetch<BudgetStatus>(`/workspaces/${workspaceId}/budget`),
          apiFetch<GoalsOverview>(`/workspaces/${workspaceId}/goals`),
        ]);
        setData({ budget: budgetRes.has_budget ? budgetRes : null, goals: goalRes.goals ?? [] });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        <View style={styles.header}>
          <BarChart3 size={22} color={Colors.accent} strokeWidth={2} />
          <Text style={styles.title}>Plan</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.accent} size="large" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Budgets */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Budgets</Text>
                <TouchableOpacity>
                  <Text style={styles.sectionLink}>See all</Text>
                </TouchableOpacity>
              </View>
              {!data.budget ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No budgets yet.</Text>
                </View>
              ) : (
                [data.budget].map((budget) => {
                  const totalBudgeted = budget.planned_total;
                  const totalActual = budget.spent_total;
                  const pct = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0;
                  const color = pct >= 100 ? Colors.error : pct >= 80 ? Colors.warn : Colors.ok;

                  return (
                    <View key={budget.budget_id} style={[styles.card, Shadow.card]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{budget.name}</Text>
                          <Text style={styles.cardSub}>{budget.cadence}</Text>
                        </View>
                        <Text style={[styles.pctText, { color }]}>{Math.round(pct)}%</Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(pct, 100)}%` as any,
                              backgroundColor: color,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Goals */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Goals</Text>
                <TouchableOpacity>
                  <Text style={styles.sectionLink}>See all</Text>
                </TouchableOpacity>
              </View>
              {data.goals.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No savings goals yet.</Text>
                </View>
              ) : (
                data.goals.slice(0, 3).map((goal) => {
                  const pct =
                    goal.target_minor > 0 && goal.current_minor !== null
                      ? (goal.current_minor / goal.target_minor) * 100
                      : 0;
                  return (
                    <View key={goal.id} style={[styles.card, Shadow.card]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                        <View style={styles.goalIcon}>
                          <Target size={20} color={Colors.accent} strokeWidth={2} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{goal.name}</Text>
                          <Text style={styles.cardSub}>
                            {goal.current_minor === null
                              ? 'Link an account to track progress'
                              : goal.target_date
                                ? `Target: ${goal.target_date}`
                                : 'No deadline'}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.pctText,
                            { color: pct >= 100 ? Colors.ok : Colors.accent },
                          ]}
                        >
                          {Math.round(pct)}%
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(pct, 100)}%` as any,
                              backgroundColor: pct >= 100 ? Colors.ok : Colors.accent,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Quick nav */}
            <View style={styles.quickGrid}>
              {[
                { icon: Repeat2, label: 'Recurring', hint: 'Rules' },
                { icon: Calendar, label: 'Calendar', hint: 'Events' },
              ].map(({ icon: Icon, label, hint }) => (
                <TouchableOpacity key={label} style={styles.quickCard}>
                  <Icon size={22} color={Colors.accent} strokeWidth={2} />
                  <Text style={styles.quickLabel}>{label}</Text>
                  <Text style={styles.quickHint}>{hint}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  title: { ...Typography.h2 },
  section: { marginBottom: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitle: { ...Typography.label },
  sectionLink: { fontSize: 13, color: Colors.accent, fontWeight: '600' },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  cardTitle: { ...Typography.body, fontWeight: '600' },
  cardSub: { ...Typography.caption, marginTop: 2 },
  progressBar: {
    height: 4,
    backgroundColor: Colors.bgElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 2 },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctText: { fontSize: 15, fontWeight: '800' },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  emptyText: { ...Typography.bodyDim },
  quickGrid: { flexDirection: 'row', gap: Spacing.md },
  quickCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickLabel: { ...Typography.body, fontWeight: '600', fontSize: 14 },
  quickHint: { ...Typography.caption },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    marginTop: Spacing.lg,
  },
  errorText: { color: Colors.error, textAlign: 'center' },
});
