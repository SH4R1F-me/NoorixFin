'use client';

/**
 * Reports — category breakdown and a six-month trend.
 *
 * ── WHY THERE IS NO CHART LIBRARY ────────────────────────────────────────────
 * Both visualisations are plain CSS bars built from the same array the table
 * renders. A canvas chart would be a blank rectangle to a screen reader and
 * would need a separately-maintained text alternative; here the table IS the
 * data, so the two cannot disagree. It also keeps the bundle free of a
 * charting dependency for two bar charts.
 *
 * §5.5 requires "Charts-এর সঙ্গে text/table alternative" — the table below is
 * that alternative, present in the DOM rather than behind a toggle that
 * defaults to hidden, and every bar carries its value in text as well.
 *
 * §11.3 requires a report to carry period, timezone, currency basis and
 * generated-at. All four are rendered in the footer, because a screenshot of a
 * report without them cannot be interpreted later.
 */
import { useState } from 'react';
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { useLocale } from '../../../lib/i18n/locale-provider';
import type { CashFlowReport, CategoryReport, NetWorthReport } from '../../../lib/workspace';
import { EmptyState, PageHeader, field, labelFor, money, num, percent } from '../planning-ui';

export default function ReportsView({
  report,
  cashFlow,
  incomeExpense,
  netWorth,
  currency,
}: {
  report: CategoryReport;
  cashFlow: CashFlowReport;
  incomeExpense: CashFlowReport;
  netWorth: NetWorthReport;
  currency: string;
}) {
  const { t, locale } = useLocale();
  const [showTable, setShowTable] = useState(true);

  const categories = report.categories ?? [];
  const trend = report.trend ?? [];
  const cashPeriods = cashFlow.periods ?? [];
  const incomeExpensePeriods = incomeExpense.periods ?? [];
  const worthPeriods = netWorth.periods ?? [];
  const basis = report.currency_basis ?? currency;
  const fmt = (minor: number) => money(minor, basis, locale);

  const expenses = categories.filter((c) => c.kind === 'EXPENSE');
  const income = categories.filter((c) => c.kind === 'INCOME');
  const expenseTotal = expenses.reduce((sum, c) => sum + c.amount_minor, 0);
  const incomeTotal = income.reduce((sum, c) => sum + c.amount_minor, 0);

  // Scale the trend bars to the largest single value across BOTH series, so
  // income and expense stay visually comparable. Scaling each series to its own
  // max would make a small income month look like a large one.
  const trendMax = Math.max(
    1,
    ...trend.map((month) => Math.max(month.income_minor, month.expense_minor)),
  );

  if (
    categories.length === 0 &&
    trend.every((m) => m.income_minor === 0 && m.expense_minor === 0) &&
    cashPeriods.every((p) => p.income_minor === 0 && p.expense_minor === 0) &&
    worthPeriods.every((p) => p.net_worth_minor === 0)
  ) {
    return (
      <div>
        <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} />
        <EmptyState
          icon={<BarChart3 size={30} color="#10b981" aria-hidden="true" />}
          title={t('reports.noData')}
          body={t('reports.noDataBody')}
          action={
            <a href="/dashboard/transactions" style={{ ...field.primary, textDecoration: 'none' }}>
              {t('transactions.addTransaction')}
            </a>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        action={
          <button type="button" onClick={() => setShowTable(!showTable)} style={field.ghost}>
            {showTable ? t('app.hideTable') : t('app.showTable')}
          </button>
        }
      />

      <form
        method="get"
        style={{ ...field.card, ...styles.rangeForm }}
        aria-label={t('reports.custom')}
      >
        <label style={styles.rangeLabel}>
          {t('reports.from')}
          <input
            name="from"
            type="date"
            defaultValue={cashFlow.period_from}
            style={styles.dateInput}
          />
        </label>
        <label style={styles.rangeLabel}>
          {t('reports.to')}
          <input name="to" type="date" defaultValue={cashFlow.period_to} style={styles.dateInput} />
        </label>
        <label style={styles.rangeLabel}>
          {t('reports.granularity')}
          <select
            name="granularity"
            defaultValue={cashFlow.granularity ?? 'month'}
            style={styles.dateInput}
          >
            <option value="day">{t('reports.day')}</option>
            <option value="week">{t('reports.week')}</option>
            <option value="month">{t('reports.month')}</option>
          </select>
        </label>
        <button type="submit" style={field.primary}>
          {t('reports.apply')}
        </button>
      </form>

      <div style={styles.totals}>
        <div style={field.card}>
          <span style={field.meta}>
            <TrendingUp size={13} aria-hidden="true" /> {t('transactions.income')}
          </span>
          <p style={{ ...styles.totalValue, color: '#10b981' }}>{fmt(incomeTotal)}</p>
        </div>
        <div style={field.card}>
          <span style={field.meta}>
            <TrendingDown size={13} aria-hidden="true" /> {t('transactions.expense')}
          </span>
          <p style={{ ...styles.totalValue, color: '#f87171' }}>{fmt(expenseTotal)}</p>
        </div>
        <div style={field.card}>
          <span style={field.meta}>{t('reports.cashFlow')}</span>
          <p
            style={{
              ...styles.totalValue,
              color: incomeTotal - expenseTotal >= 0 ? '#10b981' : '#f87171',
            }}
          >
            {fmt(incomeTotal - expenseTotal)}
          </p>
        </div>
      </div>

      <TimeSeriesTable
        heading={t('reports.cashFlow')}
        periods={cashPeriods.map((period) => ({
          date: period.period_start,
          first: period.income_minor,
          second: period.expense_minor,
          total: period.net_minor,
        }))}
        labels={[t('transactions.income'), t('transactions.expense'), t('reports.cashFlow')]}
        fmt={fmt}
      />

      <TimeSeriesTable
        heading={t('reports.netWorth')}
        periods={worthPeriods.map((period) => ({
          date: period.period_start,
          first: period.assets_minor,
          second: period.liabilities_minor,
          total: period.net_worth_minor,
        }))}
        labels={[t('reports.assets'), t('reports.liabilities'), t('reports.netWorth')]}
        fmt={fmt}
      />

      <TimeSeriesTable
        heading={t('reports.incomeVsExpense')}
        periods={incomeExpensePeriods.map((period) => ({
          date: period.period_start,
          first: period.income_minor,
          second: period.expense_minor,
          total: period.net_minor,
        }))}
        labels={[t('transactions.income'), t('transactions.expense'), t('reports.cashFlow')]}
        fmt={fmt}
      />

      {/* ── Category breakdown ────────────────────────────────────────────── */}
      <section
        style={{ ...field.card, marginBottom: '1.5rem' }}
        aria-labelledby="breakdown-heading"
      >
        <h2 id="breakdown-heading" style={styles.sectionTitle}>
          {t('reports.categoryBreakdown')}
        </h2>

        {expenses.length === 0 ? (
          <p style={field.meta}>{t('app.noneYet')}</p>
        ) : (
          <ul style={styles.barList}>
            {expenses.map((category) => {
              const share = expenseTotal > 0 ? (category.amount_minor / expenseTotal) * 100 : 0;
              const name = labelFor(category, t);
              return (
                <li key={category.category_id} style={styles.barRow}>
                  <div style={styles.barLabel}>
                    <span aria-hidden="true">{category.icon}</span>
                    <span style={styles.barName}>{name}</span>
                  </div>
                  <div style={styles.barTrack}>
                    <div
                      aria-hidden="true"
                      style={{
                        ...styles.barFill,
                        width: `${share}%`,
                        background: category.color,
                      }}
                    />
                  </div>
                  {/* The value in text beside every bar — a bar alone conveys
                      nothing without sight, and §5.5 forbids relying on it. */}
                  <span style={styles.barValue}>
                    {fmt(category.amount_minor)} · {percent(share, locale)}
                  </span>
                  <a
                    href={`/dashboard/transactions?category=${category.category_id}`}
                    style={styles.drill}
                    aria-label={`${t('dashboard.drillDown')}: ${name}`}
                  >
                    →
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Six-month trend ───────────────────────────────────────────────── */}
      <section style={{ ...field.card, marginBottom: '1.5rem' }} aria-labelledby="trend-heading">
        <h2 id="trend-heading" style={styles.sectionTitle}>
          {t('reports.incomeVsExpense')} · {t('reports.sixMonths')}
        </h2>

        <div style={styles.trendChart} role="img" aria-label={buildTrendSummary(trend, fmt, t)}>
          {trend.map((month) => (
            <div key={month.month} style={styles.trendColumn}>
              <div style={styles.trendBars}>
                <div
                  style={{
                    ...styles.trendBar,
                    height: `${(month.income_minor / trendMax) * 100}%`,
                    background: 'linear-gradient(180deg,#10b981,#059669)',
                  }}
                />
                <div
                  style={{
                    ...styles.trendBar,
                    height: `${(month.expense_minor / trendMax) * 100}%`,
                    background: 'linear-gradient(180deg,#f87171,#dc2626)',
                  }}
                />
              </div>
              <span style={styles.trendLabel}>{month.month.slice(5)}</span>
            </div>
          ))}
        </div>

        <div style={styles.legend}>
          <span style={styles.legendItem}>
            <span style={{ ...styles.swatch, background: '#10b981' }} aria-hidden="true" />
            {t('transactions.income')}
          </span>
          <span style={styles.legendItem}>
            <span style={{ ...styles.swatch, background: '#ef4444' }} aria-hidden="true" />
            {t('transactions.expense')}
          </span>
        </div>
      </section>

      {/* ── Table alternative (§5.5) ──────────────────────────────────────── */}
      {showTable && (
        <section style={field.card} aria-labelledby="table-heading">
          <h2 id="table-heading" style={styles.sectionTitle}>
            {t('reports.categoryBreakdown')}
          </h2>
          <p style={{ ...field.meta, marginBottom: '0.85rem' }}>{t('reports.chartTableNote')}</p>

          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <caption style={styles.caption}>
                {t('reports.categoryBreakdown')} — {report.period_from} → {report.period_to}
              </caption>
              <thead>
                <tr>
                  {/*
                    `scope` on every header cell. Without it a screen reader
                    cannot associate a number with its column, which turns the
                    table into a stream of unlabelled figures — the audit found
                    scope missing from all six tables in the app.
                  */}
                  <th scope="col" style={styles.th}>
                    {t('transactions.category')}
                  </th>
                  <th scope="col" style={styles.th}>
                    {t('transactions.title')}
                  </th>
                  <th scope="col" style={{ ...styles.th, textAlign: 'right' }}>
                    {t('reports.entries')}
                  </th>
                  <th scope="col" style={{ ...styles.th, textAlign: 'right' }}>
                    {t('transactions.amount')}
                  </th>
                  <th scope="col" style={{ ...styles.th, textAlign: 'right' }}>
                    {t('reports.share')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => {
                  const base = category.kind === 'EXPENSE' ? expenseTotal : incomeTotal;
                  const share = base > 0 ? (category.amount_minor / base) * 100 : 0;
                  return (
                    <tr key={category.category_id}>
                      <th scope="row" style={styles.td}>
                        <span aria-hidden="true">{category.icon}</span> {labelFor(category, t)}
                      </th>
                      <td style={styles.td}>
                        {category.kind === 'EXPENSE'
                          ? t('transactions.expense')
                          : t('transactions.income')}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {num(category.entry_count, locale)}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {fmt(category.amount_minor)}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{percent(share, locale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* §11.3 report metadata — without it a saved report is uninterpretable. */}
      <footer style={styles.footer}>
        <span>
          {t('reports.period')}: {report.period_from} → {report.period_to}
        </span>
        <span>{t('reports.currencyBasis', { currency: basis })}</span>
        {report.timezone && <span>{report.timezone}</span>}
        {report.generated_at && (
          <span>
            {t('reports.generatedAt', {
              when: new Date(report.generated_at).toLocaleString(
                locale === 'bn' ? 'bn-BD' : 'en-BD',
              ),
            })}
          </span>
        )}
      </footer>
    </div>
  );
}

function TimeSeriesTable({
  heading,
  periods,
  labels,
  fmt,
}: {
  heading: string;
  periods: { date: string; first: number; second: number; total: number }[];
  labels: [string, string, string];
  fmt: (minor: number) => string;
}) {
  return (
    <section
      style={{ ...field.card, marginBottom: '1.5rem' }}
      aria-labelledby={`${heading.replace(/\s/g, '-')}-heading`}
    >
      <h2 id={`${heading.replace(/\s/g, '-')}-heading`} style={styles.sectionTitle}>
        {heading}
      </h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th scope="col" style={styles.th}>
                Date
              </th>
              <th scope="col" style={{ ...styles.th, textAlign: 'right' }}>
                {labels[0]}
              </th>
              <th scope="col" style={{ ...styles.th, textAlign: 'right' }}>
                {labels[1]}
              </th>
              <th scope="col" style={{ ...styles.th, textAlign: 'right' }}>
                {labels[2]}
              </th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period.date}>
                <th scope="row" style={styles.td}>
                  {period.date}
                </th>
                <td style={{ ...styles.td, textAlign: 'right' }}>{fmt(period.first)}</td>
                <td style={{ ...styles.td, textAlign: 'right' }}>{fmt(period.second)}</td>
                <td
                  style={{
                    ...styles.td,
                    textAlign: 'right',
                    color: period.total >= 0 ? '#10b981' : '#f87171',
                  }}
                >
                  {fmt(period.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * The trend chart's accessible name.
 *
 * A `role="img"` with no label is invisible to assistive technology; this
 * renders the same six data points as a sentence, so the chart is not the only
 * way to reach them.
 */
function buildTrendSummary(
  trend: { month: string; income_minor: number; expense_minor: number }[],
  fmt: (minor: number) => string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  return trend
    .map(
      (month) =>
        `${month.month}: ${t('transactions.income')} ${fmt(month.income_minor)}, ` +
        `${t('transactions.expense')} ${fmt(month.expense_minor)}`,
    )
    .join('; ');
}

const styles: Record<string, React.CSSProperties> = {
  rangeForm: {
    display: 'flex',
    alignItems: 'end',
    flexWrap: 'wrap',
    gap: '0.8rem',
    marginBottom: '1.5rem',
  },
  rangeLabel: { display: 'grid', gap: 5, color: '#94a3b8', fontSize: 12, fontWeight: 600 },
  dateInput: {
    height: 38,
    minWidth: 130,
    borderRadius: 7,
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#f8fafc',
    padding: '0 9px',
  },
  totals: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  totalValue: {
    fontSize: '1.5rem',
    fontWeight: 800,
    margin: '0.35rem 0 0',
    fontVariantNumeric: 'tabular-nums',
  },
  sectionTitle: { fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 1rem' },
  barList: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.85rem' },
  barRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  barLabel: { display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 150 },
  barName: { fontSize: '0.875rem', color: '#f8fafc' },
  barTrack: {
    flex: 1,
    minWidth: 120,
    height: 10,
    background: '#334155',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 5, transition: 'width 600ms ease-out' },
  barValue: {
    fontSize: '0.8125rem',
    color: '#94a3b8',
    fontVariantNumeric: 'tabular-nums',
    minWidth: 130,
    textAlign: 'right',
  },
  drill: { color: '#10b981', textDecoration: 'none', fontSize: '1rem' },
  trendChart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0.75rem',
    height: 180,
    padding: '0.5rem 0',
  },
  trendColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.4rem',
    height: '100%',
  },
  trendBars: {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-end',
    gap: 3,
    width: '100%',
    justifyContent: 'center',
  },
  trendBar: {
    width: '42%',
    minHeight: 2,
    borderRadius: '3px 3px 0 0',
    transition: 'height 600ms ease-out',
  },
  trendLabel: { fontSize: '0.6875rem', color: '#8b9ab0' },
  legend: { display: 'flex', gap: '1rem', marginTop: '0.5rem' },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.75rem',
    color: '#94a3b8',
  },
  swatch: { width: 10, height: 10, borderRadius: 2, display: 'inline-block' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' },
  caption: {
    captionSide: 'bottom',
    textAlign: 'left',
    fontSize: '0.6875rem',
    color: '#8b9ab0',
    paddingTop: '0.6rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.55rem 0.6rem',
    borderBottom: '1px solid #334155',
    color: '#94a3b8',
    fontWeight: 600,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: {
    padding: '0.55rem 0.6rem',
    borderBottom: '1px solid #1e293b',
    color: '#e2e8f0',
    fontWeight: 400,
    textAlign: 'left',
  },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
    marginTop: '1.5rem',
    paddingTop: '1rem',
    borderTop: '1px solid #1e293b',
    fontSize: '0.6875rem',
    color: '#8b9ab0',
  },
};
