/**
 * Recurring reminders — first-class Phase 5 route.
 *
 * Data stays server-fetched and the interactive form remains a narrow client
 * boundary. A rule is a template only: even AUTO_CREATE_DRAFT cannot post a
 * ledger entry without the user confirming it.
 */
import { Repeat2 } from 'lucide-react';
import {
  categoryLabel,
  getAccounts,
  getActiveWorkspace,
  getCategories,
  getRecurringRules,
} from '../../../lib/workspace';
import { getServerT } from '../../../lib/i18n/locale';
import RecurringPanel from '../calendar/recurring-panel';

export default async function RecurringPage() {
  const workspace = await getActiveWorkspace();
  const t = await getServerT();

  if (!workspace) {
    return (
      <div>
        <h1>{t('calendar.recurringRules')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('app.noneYet')}</p>
      </div>
    );
  }

  const [rules, accountRows, categoryRows] = await Promise.all([
    getRecurringRules(workspace.id),
    getAccounts(workspace.id),
    getCategories(workspace.id),
  ]);
  const active = rules.filter((rule) => rule.status === 'ACTIVE').length;
  const paused = rules.filter((rule) => rule.status === 'PAUSED').length;

  return (
    <div>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>
            <Repeat2 size={15} aria-hidden="true" />
            {t('recurring.schedule')}
          </div>
          <h1 style={styles.title}>{t('calendar.recurringRules')}</h1>
          <p style={styles.subtitle}>{t('calendar.behaviourNote')}</p>
        </div>
        <dl style={styles.summary} aria-label={t('recurring.summary')}>
          <div>
            <dt style={styles.metricLabel}>{t('recurring.active')}</dt>
            <dd style={styles.metric}>{active}</dd>
          </div>
          <div>
            <dt style={styles.metricLabel}>{t('calendar.paused')}</dt>
            <dd style={styles.metric}>{paused}</dd>
          </div>
        </dl>
      </header>

      <RecurringPanel
        rules={rules}
        accounts={accountRows
          .filter(
            (account) =>
              !account.archived_at &&
              account.subtype !== 'CATEGORY' &&
              account.subtype !== 'SYSTEM',
          )
          .map((account) => ({ id: account.id, label: account.name }))}
        categories={categoryRows
          .filter((category) => !category.archived_at)
          .map((category) => ({
            id: category.id,
            label: categoryLabel(category, t),
            kind: category.kind,
          }))}
        workspaceId={workspace.id}
        currency={workspace.base_currency ?? 'BDT'}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '1.5rem',
    flexWrap: 'wrap',
    marginBottom: '1.5rem',
  },
  eyebrow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: 'var(--color-transfer)',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: { margin: '0.35rem 0', color: 'var(--text-primary)', fontSize: '2rem' },
  subtitle: { margin: 0, color: 'var(--text-secondary)', maxWidth: 680, lineHeight: 1.55 },
  summary: {
    display: 'flex',
    gap: '1.5rem',
    margin: 0,
    padding: '0.8rem 1rem',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: '0.85rem',
  },
  metricLabel: { color: 'var(--text-tertiary)', fontSize: '0.7rem', fontWeight: 600 },
  metric: {
    margin: '0.15rem 0 0',
    color: 'var(--text-primary)',
    fontSize: '1.2rem',
    fontWeight: 750,
  },
};
