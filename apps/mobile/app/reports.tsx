import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { formatAmount, getCurrency } from '@noorixfin/money';
import { apiFetch } from '../src/lib/api';
import { useWorkspace } from '../src/lib/WorkspaceContext';
import { activeMobileLocale } from '../src/lib/i18n';
import { Card, Empty, Notice, Screen, primitiveStyles } from '../src/components/ScreenPrimitives';
import { useTranslation } from 'react-i18next';

type Category = { category_id: string; custom_name: string | null; translation_key: string | null; icon: string | null; kind: string; amount_minor: number; entry_count: number };
type Trend = { month: string; income_minor: number; expense_minor: number };
type Report = { visible: boolean; period_from: string; period_to: string; currency_basis: string; categories: Category[]; trend: Trend[] };

export default function ReportsScreen() {
  const { workspaceId, workspaceCurrency } = useWorkspace();
  const { t } = useTranslation();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!workspaceId) return;
    try { setReport(await apiFetch(`/workspaces/${workspaceId}/reports/categories`)); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load report'); }
  }, [workspaceId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const currencyCode = report?.currency_basis ?? workspaceCurrency;
  const money = (minor: number) => `${getCurrency(currencyCode).symbol}${formatAmount(Math.abs(minor), currencyCode, activeMobileLocale())}`;
  return (
    <Screen title={t('mobile.management.reports')}>
      {error ? <Notice error>{error}</Notice> : null}
      {report ? <Notice>{report.period_from} – {report.period_to} · {currencyCode}</Notice> : null}
      <Text style={primitiveStyles.section}>{t('mobile.management.categoryBreakdown')}</Text>
      {!report?.categories?.length ? <Empty>{t('mobile.management.noActivity')}</Empty> : report.categories.map((category) => (
        <Card key={category.category_id}>
          <View style={primitiveStyles.between}><Text style={primitiveStyles.cardTitle}>{category.icon} {category.custom_name ?? category.translation_key ?? category.kind}</Text><Text style={primitiveStyles.cardTitle}>{money(category.amount_minor)}</Text></View>
          <Text style={primitiveStyles.secondary}>{t('mobile.management.transactionCount', { count: category.entry_count })}</Text>
        </Card>
      ))}
      <Text style={primitiveStyles.section}>{t('mobile.management.sixMonthTrend')}</Text>
      {(report?.trend ?? []).map((point) => (
        <Card key={point.month}><Text style={primitiveStyles.cardTitle}>{point.month}</Text><Text style={primitiveStyles.secondary}>{t('mobile.management.incomeExpense', { income: money(point.income_minor), expense: money(point.expense_minor) })}</Text></Card>
      ))}
    </Screen>
  );
}
