'use client';

/**
 * Dashboard body.
 *
 * TWO FABRICATED SECTIONS WERE REMOVED HERE (2026-08-04 audit):
 *
 *   - "Budget progress" rendered three hardcoded rows — খাদ্য ৳12,500/৳20,000,
 *     পরিবহন ৳5,800/৳8,000, বিনোদন ৳4,200/৳5,000 — as if they were the user's
 *     own budgets.
 *   - "Savings goal" rendered a hardcoded জরুরি তহবিল at ৳75,000 / ৳2,00,000, 37.5%.
 *
 * Neither came from the ledger. On a finance app, invented numbers presented as
 * the user's money are the most damaging thing the UI can do, and DEC-012
 * forbids exactly this. Budgets and Goals are not built yet, so these now say
 * so instead of lying convincingly.
 *
 * Every string comes from the shared catalog (DEC-021) — this component used to
 * hardcode 31 Bangla literals, which is why the language toggle never reached it.
 */
import {
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Plus,
  Wallet,
  CreditCard,
  Smartphone,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { formatAmount } from '@noorixfin/money';
import { intlLocale } from '@noorixfin/i18n';
import { useLocale } from '../../lib/i18n/locale-provider';

export interface SummaryCard {
  /** Translation key. The server no longer ships pre-rendered label text. */
  titleKey: string;
  amount: string;
  change: string | null;
  positive: boolean;
  iconKey: 'wallet' | 'up' | 'down' | 'flow';
  gradient: string;
  /**
   * Where this figure breaks down. §5.3: "কোনো metric শুধু aggregate number
   * দেখাবে না; click/tap করলে included accounts, period, filters এবং source
   * transactions দেখা যাবে." Every card had `cursor: pointer` and no
   * destination — it looked clickable and did nothing.
   */
  href: string;
}

export interface RecentTx {
  payee: string;
  amount: number;
  category: string;
  date: string;
}

/**
 * The four panels below carry REAL data now. They rendered hardcoded numbers
 * until the 2026-08-04 audit, then honest "coming soon" placeholders once those
 * were removed, and now the aggregations that back them exist.
 *
 * Every figure is derived server-side from postings (DEC-011, DEC-022). Note
 * `current: number | null` on a goal — null means no linked account, which is
 * not the same statement as zero saved.
 */
export interface BudgetPanelLine {
  categoryId: string;
  name: string;
  translationKey: string | null;
  icon: string;
  spent: number;
  planned: number;
  over: boolean;
}

export interface BillPanelItem {
  id: string;
  name: string;
  amount: number;
  date: string;
  daysAway: number;
  status: 'UPCOMING' | 'DUE' | 'OVERDUE';
  isIncome: boolean;
}

export interface GoalPanelItem {
  id: string;
  name: string;
  current: number | null;
  target: number;
}

const ICONS = { wallet: Wallet, up: TrendingUp, down: TrendingDown, flow: ArrowLeftRight } as const;

export default function DashboardView({
  summaryCards: rawCards,
  recentTransactions,
  upcomingBills,
  budgetLines = [],
  goals = [],
  totalDebt = 0,
  currencySymbol = '৳',
  currency = 'BDT',
}: {
  summaryCards: SummaryCard[];
  recentTransactions: RecentTx[];
  upcomingBills: BillPanelItem[];
  budgetLines?: BudgetPanelLine[];
  goals?: GoalPanelItem[];
  totalDebt?: number;
  currencySymbol?: string;
  /** Needed as well as the symbol — the CODE is what carries the exponent. */
  currency?: string;
}) {
  const { t, locale } = useLocale();
  const [showMobileCard, setShowMobileCard] = useState(true);
  const summaryCards = rawCards.map((c) => ({ ...c, icon: ICONS[c.iconKey] }));

  /**
   * Every amount on this page is in MINOR units (DEC-004).
   *
   * `Intl.NumberFormat` alone renders them as if they were major — 3,000,000
   * poisha displayed as "৳ ৩০,০০,০০০" instead of "৳ ৩০,০০০.০০", a 100×
   * overstatement of the user's debt. `formatAmount` divides by the currency's
   * real exponent, which is also why the currency CODE has to reach this
   * component and not just its symbol: JPY has exponent 0 and KWD has 3, so
   * "/100" is not a safe shortcut either.
   */
  const amount = (minor: number) =>
    `${currencySymbol} ${formatAmount(Math.abs(minor), currency, intlLocale[locale])}`;

  /**
   * Counts and percentages in the reader's digits too.
   *
   * Amounts already followed the locale; counts did not, so a Bangla page read
   * "2 দিন আগে · ৳৮০০.০০" — two numbering systems in one line. §4.6 raised this
   * for amounts, and the same argument covers every number on screen.
   */
  const count = (value: number) => new Intl.NumberFormat(intlLocale[locale]).format(value);

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.greeting}>{t('dashboard.greeting')} 👋</h1>
          <p style={styles.subGreeting}>{t('dashboard.subtitle')}</p>
        </div>
        <a
          href="/dashboard/transactions?new=1"
          style={{ ...styles.addBtn, textDecoration: 'none' }}
        >
          <Plus size={20} />
          <span>{t('transactions.addTransaction')}</span>
        </a>
      </div>

      {showMobileCard && (
        <aside style={styles.mobileCard} aria-label="Continue on the NoorixFin mobile app">
          <div style={styles.mobileCardIcon}>
            <Smartphone size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Continue on mobile</strong>
            <p style={{ ...styles.emptyHint, padding: '.25rem 0 0' }}>
              Work offline and pair this workspace with a secure one-time QR code. App-lock support
              is not advertised until its device acceptance checks pass.
            </p>
          </div>
          <a href="/dashboard/settings/mobile" style={styles.mobileCardLink}>
            Set up mobile
          </a>
          <button
            onClick={() => setShowMobileCard(false)}
            style={styles.mobileCardClose}
            aria-label="Dismiss mobile app suggestion"
          >
            <X size={16} />
          </button>
        </aside>
      )}

      {/* Summary Cards */}
      <div style={styles.cardGrid}>
        {summaryCards.map((card, i) => {
          const Icon = card.icon;
          return (
            // An <a>, not a <div> with an onClick: it is keyboard-reachable,
            // announces itself as a link, and works with middle-click — none of
            // which a div gives you (§5.5 keyboard navigation).
            <a
              key={i}
              href={card.href}
              style={{ ...styles.summaryCard, animationDelay: `${i * 80}ms` }}
              aria-label={`${t(card.titleKey)}: ${card.amount}. ${t('dashboard.drillDown')}`}
            >
              <div style={styles.cardHeader}>
                <div style={{ ...styles.cardIcon, background: card.gradient }}>
                  <Icon size={20} color="white" />
                </div>
                {/* No prior-month figure means the change is undefined, not
                    zero and not +100%. Render nothing rather than invent one. */}
                {card.change !== null && (
                  <span
                    style={{
                      ...styles.cardChange,
                      color: card.positive ? 'var(--color-primary-500)' : 'var(--color-error)',
                      background: card.positive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    }}
                  >
                    {card.change}
                  </span>
                )}
              </div>
              <p style={styles.cardTitle}>{t(card.titleKey)}</p>
              <p style={styles.cardAmount}>{card.amount}</p>
            </a>
          );
        })}
      </div>

      {/* Content grid */}
      <div className="nf-content-grid" style={styles.contentGrid}>
        {/* Recent Transactions */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>{t('dashboard.recentTransactions')}</h2>
            <a href="/dashboard/transactions" style={styles.viewAll}>
              {t('dashboard.viewAll')} →
            </a>
          </div>
          <div style={styles.transactionList}>
            {recentTransactions.length === 0 ? (
              <p style={styles.emptyHint}>{t('transactions.noTransactionsBody')}</p>
            ) : (
              recentTransactions.map((tx, i) => (
                <div key={i} style={styles.transactionItem}>
                  <div
                    style={{
                      ...styles.txIcon,
                      background: tx.amount > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    }}
                  >
                    {tx.amount > 0 ? (
                      <TrendingUp size={16} color="var(--color-primary-500)" />
                    ) : (
                      <CreditCard size={16} color="var(--color-error)" />
                    )}
                  </div>
                  <div style={styles.txInfo}>
                    <span style={styles.txPayee}>{tx.payee}</span>
                    <span style={styles.txCategory}>
                      {tx.category} · {tx.date}
                    </span>
                  </div>
                  <span
                    style={{
                      ...styles.txAmount,
                      color: tx.amount > 0 ? 'var(--color-primary-500)' : 'var(--color-error)',
                    }}
                  >
                    {tx.amount > 0 ? '+' : ''}
                    {amount(tx.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={styles.rightColumn}>
          {/* Budget progress — §5.3 item 3. Spend derived from postings. */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>{t('dashboard.budgetProgress')}</h2>
              <a href="/dashboard/budgets" style={styles.viewAll}>
                {t('dashboard.details')} →
              </a>
            </div>
            {budgetLines.length === 0 ? (
              <p style={styles.emptyHint}>{t('budgets.noBudgetBody')}</p>
            ) : (
              <div style={styles.budgetList}>
                {budgetLines.map((line) => {
                  const percent = line.planned > 0 ? (line.spent / line.planned) * 100 : 0;
                  const name = line.translationKey ? t(line.translationKey) : line.name;
                  return (
                    <div key={line.categoryId} style={styles.budgetItem}>
                      <div style={styles.budgetHeader}>
                        <span style={styles.budgetName}>
                          <span aria-hidden="true">{line.icon}</span> {name}
                        </span>
                        <span style={styles.budgetNumbers}>
                          {amount(line.spent)} / {amount(line.planned)}
                        </span>
                      </div>
                      {/* A real progressbar, not a coloured div: §5.5 forbids
                          conveying state by colour alone, and a bar with no
                          accessible value conveys nothing at all. */}
                      <div
                        role="progressbar"
                        aria-valuenow={Math.round(percent)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${name}: ${t('budgets.usedPercent', { percent: count(Math.round(percent)) })}`}
                        style={styles.progressBar}
                      >
                        <div
                          aria-hidden="true"
                          style={{
                            ...styles.progressFill,
                            width: `${Math.min(percent, 100)}%`,
                            background: line.over ? '#ef4444' : 'var(--color-primary-500)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming bills — §5.3 item 4. Overdue derived from today. */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>{t('dashboard.upcomingBills')}</h2>
              <a href="/dashboard/calendar" style={styles.viewAll}>
                {t('nav.calendar')} →
              </a>
            </div>
            <div style={styles.billList}>
              {upcomingBills.length === 0 ? (
                <p style={styles.emptyHint}>{t('calendar.noEventsBody')}</p>
              ) : (
                upcomingBills.map((bill) => (
                  <div key={bill.id} style={styles.billItem}>
                    <span style={styles.billIcon} aria-hidden="true">
                      {bill.isIncome ? '💰' : bill.status === 'OVERDUE' ? '⚠️' : '📄'}
                    </span>
                    <div style={styles.billInfo}>
                      <span style={styles.billName}>{bill.name}</span>
                      <span
                        style={{
                          ...styles.billDue,
                          // Colour AND word — the word is what survives
                          // greyscale and a screen reader (§5.5).
                          color:
                            bill.status === 'OVERDUE'
                              ? 'var(--color-error)'
                              : 'var(--text-tertiary)',
                        }}
                      >
                        {bill.status === 'OVERDUE'
                          ? `${t('calendar.overdue')} · ${t('calendar.daysAgo', { count: count(Math.abs(bill.daysAway)) })}`
                          : bill.daysAway === 0
                            ? t('calendar.dueToday')
                            : t('calendar.inDays', { count: count(bill.daysAway) })}
                      </span>
                    </div>
                    <span
                      style={{
                        ...styles.billAmount,
                        color: bill.isIncome ? 'var(--color-primary-500)' : 'var(--text-primary)',
                      }}
                    >
                      {bill.isIncome ? '+' : ''}
                      {amount(bill.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Savings goals — §5.3 item 5. Progress is the linked balance. */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>{t('dashboard.savingsProgress')}</h2>
              <a href="/dashboard/goals" style={styles.viewAll}>
                {t('dashboard.details')} →
              </a>
            </div>
            {goals.length === 0 ? (
              <p style={styles.emptyHint}>{t('goals.noGoalsBody')}</p>
            ) : (
              <div style={styles.budgetList}>
                {goals.map((goal) => {
                  // null current means no linked account. Rendering it as a 0%
                  // bar would assert something the system does not know.
                  if (goal.current === null) {
                    return (
                      <div key={goal.id} style={styles.budgetItem}>
                        <div style={styles.budgetHeader}>
                          <span style={styles.budgetName}>{goal.name}</span>
                          <span style={styles.budgetNumbers}>{amount(goal.target)}</span>
                        </div>
                        <span style={styles.emptyHint}>{t('goals.noLinkBody')}</span>
                      </div>
                    );
                  }
                  const percent = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
                  return (
                    <div key={goal.id} style={styles.budgetItem}>
                      <div style={styles.budgetHeader}>
                        <span style={styles.budgetName}>{goal.name}</span>
                        <span style={styles.budgetNumbers}>
                          {amount(goal.current)} / {amount(goal.target)}
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={Math.round(percent)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${goal.name}: ${count(Math.round(percent))}%`}
                        style={styles.progressBar}
                      >
                        <div
                          aria-hidden="true"
                          style={{
                            ...styles.progressFill,
                            width: `${Math.min(percent, 100)}%`,
                            background: 'var(--color-warning)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Debt summary — §5.3 item 6. Only rendered when there is one. */}
          {totalDebt > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>{t('dashboard.debtSummary')}</h2>
                <a href="/dashboard/goals" style={styles.viewAll}>
                  {t('dashboard.details')} →
                </a>
              </div>
              <p style={{ ...styles.cardAmount, color: 'var(--color-error)', margin: 0 }}>
                {amount(totalDebt)}
              </p>
              <p style={styles.emptyHint}>{t('goals.outstanding')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  mobileCard: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '.85rem',
    marginBottom: '1.25rem',
    padding: '1rem',
    background: 'linear-gradient(100deg, rgba(16,185,129,.12), rgba(56,189,248,.08))',
    border: '1px solid rgba(52,211,153,.25)',
    borderRadius: 12,
  },
  mobileCardIcon: {
    width: 42,
    height: 42,
    display: 'grid',
    placeItems: 'center',
    color: 'var(--color-success)',
    background: 'rgba(16,185,129,.14)',
    borderRadius: 10,
  },
  mobileCardLink: {
    padding: '.55rem .8rem',
    borderRadius: 7,
    background: 'var(--color-primary-500)',
    color: 'var(--text-on-primary)',
    fontSize: '.78rem',
    fontWeight: 750,
    textDecoration: 'none',
  },
  mobileCardClose: {
    display: 'grid',
    placeItems: 'center',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: 0,
    cursor: 'pointer',
    padding: '.4rem',
  },
  emptyHint: {
    color: 'var(--text-tertiary)',
    fontSize: '0.8125rem',
    padding: '0.75rem 0',
    margin: 0,
    lineHeight: 1.6,
  },
  page: {
    animation: 'fadeIn 0.4s ease-out',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  greeting: {
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '0.25rem',
  },
  subGreeting: {
    color: 'var(--text-secondary)',
    fontSize: '0.9375rem',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1.25rem',
    background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-500))',
    color: 'white',
    border: 'none',
    borderRadius: '0.75rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 200ms',
    fontFamily: 'inherit',
    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  summaryCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: '1rem',
    padding: '1.25rem',
    animation: 'fadeIn 0.4s ease-out both',
    transition: 'all 200ms',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'block',
    color: 'inherit',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: '0.625rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardChange: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.25rem 0.5rem',
    borderRadius: '9999px',
  },
  cardTitle: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    marginBottom: '0.25rem',
  },
  cardAmount: {
    fontSize: '1.375rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-0.01em',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    gap: '1.5rem',
  },
  section: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: '1rem',
    padding: '1.25rem',
    marginBottom: '1rem',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
  },
  viewAll: {
    fontSize: '0.8125rem',
    color: 'var(--color-primary-500)',
    textDecoration: 'none',
  },
  transactionList: {
    display: 'flex',
    flexDirection: 'column',
  },
  transactionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 0',
    borderBottom: '1px solid var(--border-primary)',
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  txPayee: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  txCategory: {
    fontSize: '0.75rem',
    color: 'var(--text-tertiary)',
  },
  txAmount: {
    fontSize: '0.875rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
  },
  budgetList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  budgetItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  budgetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetName: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  budgetNumbers: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  progressBar: {
    height: 6,
    background: 'var(--bg-tertiary)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 1s ease-out',
  },
  billList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  billItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0',
  },
  billIcon: {
    fontSize: '1.25rem',
  },
  billInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  billName: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  billDue: {
    fontSize: '0.6875rem',
    color: 'var(--text-tertiary)',
  },
  billAmount: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  goalCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  goalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  goalName: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  goalProgress: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalAmount: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
  },
  goalPercent: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--color-warning)',
  },
};
