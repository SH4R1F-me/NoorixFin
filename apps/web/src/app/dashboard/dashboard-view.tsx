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
} from 'lucide-react';
import { useLocale } from '../../lib/i18n/locale-provider';

export interface SummaryCard {
  /** Translation key. The server no longer ships pre-rendered label text. */
  titleKey: string;
  amount: string;
  change: string | null;
  positive: boolean;
  iconKey: 'wallet' | 'up' | 'down' | 'flow';
  gradient: string;
}

export interface RecentTx {
  payee: string;
  amount: number;
  category: string;
  date: string;
}

const ICONS = { wallet: Wallet, up: TrendingUp, down: TrendingDown, flow: ArrowLeftRight } as const;

export default function DashboardView({
  summaryCards: rawCards,
  recentTransactions,
  upcomingBills,
  currencySymbol = '৳',
}: {
  summaryCards: SummaryCard[];
  recentTransactions: RecentTx[];
  upcomingBills: { name: string; amount: number; due: string; icon: string }[];
  currencySymbol?: string;
}) {
  const { t, locale } = useLocale();
  const summaryCards = rawCards.map((c) => ({ ...c, icon: ICONS[c.iconKey] }));
  const nf = new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD');

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.greeting}>{t('dashboard.greeting')} 👋</h1>
          <p style={styles.subGreeting}>{t('dashboard.subtitle')}</p>
        </div>
        <a href="/dashboard/transactions?new=1" style={{ ...styles.addBtn, textDecoration: 'none' }}>
          <Plus size={20} />
          <span>{t('transactions.addTransaction')}</span>
        </a>
      </div>

      {/* Summary Cards */}
      <div style={styles.cardGrid}>
        {summaryCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} style={{ ...styles.summaryCard, animationDelay: `${i * 80}ms` }}>
              <div style={styles.cardHeader}>
                <div style={{ ...styles.cardIcon, background: card.gradient }}>
                  <Icon size={20} color="white" />
                </div>
                {/* No prior-month figure means the change is undefined, not
                    zero and not +100%. Render nothing rather than invent one. */}
                {card.change !== null && (
                  <span style={{
                    ...styles.cardChange,
                    color: card.positive ? '#10b981' : '#ef4444',
                    background: card.positive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  }}>
                    {card.change}
                  </span>
                )}
              </div>
              <p style={styles.cardTitle}>{t(card.titleKey)}</p>
              <p style={styles.cardAmount}>{card.amount}</p>
            </div>
          );
        })}
      </div>

      {/* Content grid */}
      <div style={styles.contentGrid}>
        {/* Recent Transactions */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>{t('dashboard.recentTransactions')}</h2>
            <a href="/dashboard/transactions" style={styles.viewAll}>{t('dashboard.viewAll')} →</a>
          </div>
          <div style={styles.transactionList}>
            {recentTransactions.length === 0 ? (
              <p style={styles.emptyHint}>{t('transactions.noTransactionsBody')}</p>
            ) : (
              recentTransactions.map((tx, i) => (
                <div key={i} style={styles.transactionItem}>
                  <div style={{
                    ...styles.txIcon,
                    background: tx.amount > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  }}>
                    {tx.amount > 0 ? (
                      <TrendingUp size={16} color="#10b981" />
                    ) : (
                      <CreditCard size={16} color="#ef4444" />
                    )}
                  </div>
                  <div style={styles.txInfo}>
                    <span style={styles.txPayee}>{tx.payee}</span>
                    <span style={styles.txCategory}>{tx.category} · {tx.date}</span>
                  </div>
                  <span style={{
                    ...styles.txAmount,
                    color: tx.amount > 0 ? '#10b981' : '#ef4444',
                  }}>
                    {tx.amount > 0 ? '+' : ''}{currencySymbol} {nf.format(Math.abs(tx.amount))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={styles.rightColumn}>
          {/* Budget progress — feature not built; see the header note. */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>{t('dashboard.budgetProgress')}</h2>
              <a href="/dashboard/budgets" style={styles.viewAll}>{t('dashboard.details')} →</a>
            </div>
            <p style={styles.emptyHint}>{t('app.comingSoon')}</p>
          </div>

          {/* Upcoming bills — data-driven, currently always empty (Calendar unbuilt). */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>{t('dashboard.upcomingBills')}</h2>
              <a href="/dashboard/calendar" style={styles.viewAll}>{t('nav.calendar')} →</a>
            </div>
            <div style={styles.billList}>
              {upcomingBills.length === 0 ? (
                <p style={styles.emptyHint}>{t('app.comingSoon')}</p>
              ) : (
                upcomingBills.map((bill, i) => (
                  <div key={i} style={styles.billItem}>
                    <span style={styles.billIcon}>{bill.icon}</span>
                    <div style={styles.billInfo}>
                      <span style={styles.billName}>{bill.name}</span>
                      <span style={styles.billDue}>{bill.due}</span>
                    </div>
                    <span style={styles.billAmount}>{currencySymbol} {nf.format(bill.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Savings goal — feature not built; see the header note. */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>{t('dashboard.savingsProgress')}</h2>
              <a href="/dashboard/goals" style={styles.viewAll}>{t('dashboard.details')} →</a>
            </div>
            <p style={styles.emptyHint}>{t('app.comingSoon')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  emptyHint: {
    color: '#64748b',
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
    color: '#94a3b8',
    fontSize: '0.9375rem',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1.25rem',
    background: 'linear-gradient(135deg, #059669, #10b981)',
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
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '1rem',
    padding: '1.25rem',
    animation: 'fadeIn 0.4s ease-out both',
    transition: 'all 200ms',
    cursor: 'pointer',
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
    color: '#94a3b8',
    marginBottom: '0.25rem',
  },
  cardAmount: {
    fontSize: '1.375rem',
    fontWeight: 700,
    color: '#f8fafc',
    letterSpacing: '-0.01em',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    gap: '1.5rem',
  },
  section: {
    background: '#1e293b',
    border: '1px solid #334155',
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
    color: '#10b981',
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
    borderBottom: '1px solid #1e293b',
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
    color: '#f8fafc',
  },
  txCategory: {
    fontSize: '0.75rem',
    color: '#64748b',
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
    color: '#f8fafc',
  },
  budgetNumbers: {
    fontSize: '0.75rem',
    color: '#94a3b8',
  },
  progressBar: {
    height: 6,
    background: '#334155',
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
    color: '#f8fafc',
  },
  billDue: {
    fontSize: '0.6875rem',
    color: '#64748b',
  },
  billAmount: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#f8fafc',
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
    color: '#f8fafc',
  },
  goalProgress: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalAmount: {
    fontSize: '0.8125rem',
    color: '#94a3b8',
  },
  goalPercent: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#f59e0b',
  },
};
