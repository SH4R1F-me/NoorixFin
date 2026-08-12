'use client';

/**
 * Scheduled jobs view — pg_cron jobs exposed by GET /admin/jobs.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import type { ScheduledJob } from '../../../../lib/admin';
import { Panel, Badge, EmptyState, ErrorState, T, s, formatTime } from '../../ui';
import { useLocale } from '../../../../lib/i18n/locale-provider';

export default function JobsView({
  data,
  error,
}: {
  data: { jobs: ScheduledJob[]; run_at: string } | null;
  error: string | null;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const jobs = data?.jobs ?? [];
  const active = jobs.filter((j) => j.active).length;
  const disabled = jobs.filter((j) => !j.active).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={s.title}>
            <Clock size={22} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: T.accent }} />
            {t('admin.jobs.title')}
          </h1>
          <p style={s.subtitle}>{t('admin.jobs.subtitle')}</p>
        </div>
        <button onClick={() => startTransition(() => router.refresh())} disabled={pending} style={s.btnGhost}>
          <RefreshCw size={14} style={{ animation: pending ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Summary tiles */}
      <div style={{ ...s.grid, marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div style={{ ...s.panel, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textFaint, fontWeight: 600 }}>Total</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: T.text, marginTop: 6 }}>{jobs.length}</div>
        </div>
        <div style={{ ...s.panel, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textFaint, fontWeight: 600 }}>{t('admin.jobs.active')}</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: T.ok, marginTop: 6 }}>{active}</div>
        </div>
        <div style={{ ...s.panel, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textFaint, fontWeight: 600 }}>{t('admin.jobs.disabled')}</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: T.warn, marginTop: 6 }}>{disabled}</div>
        </div>
        {data && (
          <div style={{ ...s.panel, padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textFaint, fontWeight: 600 }}>Queried at</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: T.textDim, marginTop: 6 }}>{formatTime(data.run_at)}</div>
          </div>
        )}
      </div>

      {error && <ErrorState error={error} />}

      <Panel title={t('admin.jobs.title')} padded={false}>
        {jobs.length === 0 ? (
          <EmptyState text={t('admin.jobs.noJobs')} />
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>{t('admin.jobs.jobName')}</th>
                  <th style={s.th}>{t('admin.jobs.schedule')}</th>
                  <th style={s.th}>{t('admin.jobs.state')}</th>
                  <th style={s.th}>{t('admin.jobs.nextRun')}</th>
                  <th style={s.th}>Command</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.jobid}>
                    <td style={{ ...s.td, color: T.text, fontWeight: 600 }}>{job.jobname}</td>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.75rem' }}>{job.schedule}</td>
                    <td style={s.td}>
                      {job.active ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.ok, fontSize: '0.8125rem' }}>
                          <CheckCircle size={12} />
                          {t('admin.jobs.active')}
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.warn, fontSize: '0.8125rem' }}>
                          <XCircle size={12} />
                          {t('admin.jobs.disabled')}
                        </span>
                      )}
                    </td>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.75rem', color: T.textFaint }}>
                      {job.next_run ? formatTime(job.next_run) : '—'}
                    </td>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.textFaint }}>
                      {job.command}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
