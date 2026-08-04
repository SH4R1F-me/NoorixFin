'use client';

import {
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Plus,
  Wallet,
  Target,
  Calendar,
  CreditCard,
} from 'lucide-react';

export interface SummaryCard {
  title: string;
  titleEn: string;
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
}: {
  summaryCards: SummaryCard[];
  recentTransactions: RecentTx[];
  upcomingBills: { name: string; amount: number; due: string; icon: string }[];
}) {
  const summaryCards = rawCards.map((c) => ({ ...c, icon: ICONS[c.iconKey] }));
  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.greeting}>আসসালামু আলাইকুম! 👋</h1>
          <p style={styles.subGreeting}>আপনার আর্থিক সারসংক্ষেপ দেখুন</p>
        </div>
        <button style={styles.addBtn}>
          <Plus size={20} />
          <span>নতুন লেনদেন</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div style={styles.cardGrid}>
        {summaryCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              style={{
                ...styles.summaryCard,
                animationDelay: `${i * 80}ms`,
              }}
            >
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
              <p style={styles.cardTitle}>{card.title}</p>
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
            <h2 style={styles.sectionTitle}>সাম্প্রতিক লেনদেন</h2>
            <a href="/dashboard/transactions" style={styles.viewAll}>সব দেখুন →</a>
          </div>
          <div style={styles.transactionList}>
            {recentTransactions.map((tx, i) => (
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
                  {tx.amount > 0 ? '+' : ''}৳ {Math.abs(tx.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={styles.rightColumn}>
          {/* Budget Progress */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>বাজেট অগ্রগতি</h2>
              <a href="/dashboard/budgets" style={styles.viewAll}>বিস্তারিত →</a>
            </div>
            <div style={styles.budgetList}>
              {[
                { name: 'খাদ্য', spent: 12500, total: 20000, color: '#10b981' },
                { name: 'পরিবহন', spent: 5800, total: 8000, color: '#3b82f6' },
                { name: 'বিনোদন', spent: 4200, total: 5000, color: '#f59e0b' },
              ].map((budget, i) => (
                <div key={i} style={styles.budgetItem}>
                  <div style={styles.budgetHeader}>
                    <span style={styles.budgetName}>{budget.name}</span>
                    <span style={styles.budgetNumbers}>
                      ৳{budget.spent.toLocaleString()} / ৳{budget.total.toLocaleString()}
                    </span>
                  </div>
                  <div style={styles.progressBar}>
                    <div style={{
                      ...styles.progressFill,
                      width: `${(budget.spent / budget.total) * 100}%`,
                      background: budget.color,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Bills */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>আসন্ন বিল</h2>
              <a href="/dashboard/calendar" style={styles.viewAll}>ক্যালেন্ডার →</a>
            </div>
            <div style={styles.billList}>
              {upcomingBills.map((bill, i) => (
                <div key={i} style={styles.billItem}>
                  <span style={styles.billIcon}>{bill.icon}</span>
                  <div style={styles.billInfo}>
                    <span style={styles.billName}>{bill.name}</span>
                    <span style={styles.billDue}>{bill.due}</span>
                  </div>
                  <span style={styles.billAmount}>৳ {bill.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Savings Goal */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>সঞ্চয় লক্ষ্য</h2>
            </div>
            <div style={styles.goalCard}>
              <div style={styles.goalHeader}>
                <Target size={20} color="#f59e0b" />
                <span style={styles.goalName}>জরুরি তহবিল</span>
              </div>
              <div style={styles.goalProgress}>
                <span style={styles.goalAmount}>৳ 75,000 / ৳ 2,00,000</span>
                <span style={styles.goalPercent}>37.5%</span>
              </div>
              <div style={styles.progressBar}>
                <div style={{
                  ...styles.progressFill,
                  width: '37.5%',
                  background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
