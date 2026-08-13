'use client';

import { useState, useTransition } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { ActionLink, Badge, Button, Card, EmptyState, Input, Select } from '@noorixfin/ui';
import { intlLocale } from '@noorixfin/i18n';
import type { ImportJob } from '../../../lib/workspace';
import { useLocale } from '../../../lib/i18n/locale-provider';
import { startImport } from './actions';

type Option = { id: string; label: string };

export default function ImportView({
  workspaceId,
  accounts,
  expenseCategories,
  incomeCategories,
  jobs,
}: {
  workspaceId: string;
  accounts: Option[];
  expenseCategories: Option[];
  incomeCategories: Option[];
  jobs: ImportJob[];
}) {
  const { t, locale } = useLocale();
  const [pending, begin] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [incomeCategoryId, setIncomeCategoryId] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const submit = () => {
    if (!file) {
      setMessage(t('importExport.chooseFile'));
      return;
    }
    begin(async () => {
      const extension = file.name.split('.').pop()?.toUpperCase();
      const format = extension === 'OFX' || extension === 'QIF' ? extension : 'CSV';
      const result = await startImport({
        workspaceId,
        format,
        filename: file.name,
        content: await file.text(),
        accountId,
        expenseCategoryId,
        incomeCategoryId: incomeCategoryId || undefined,
        idempotencyKey,
      });
      setMessage(
        result.ok
          ? t(result.failed ? 'importExport.successWithFailures' : 'importExport.success', {
              imported: result.imported,
              failed: result.failed,
            })
          : result.message,
      );
    });
  };

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{t('importExport.title')}</h1>
          <p style={styles.subtitle}>{t('importExport.subtitle')}</p>
        </div>
        <div style={styles.downloads}>
          <ActionLink href="/dashboard/import/export?format=csv" size="sm">
            <Download size={15} /> {t('importExport.exportCsv')}
          </ActionLink>
          <ActionLink href="/dashboard/import/export?format=pdf" size="sm">
            <Download size={15} /> {t('importExport.exportPdf')}
          </ActionLink>
        </div>
      </div>

      <Card
        title={
          <span style={styles.cardTitle}>
            <Upload size={18} /> {t('importExport.importStatement')}
          </span>
        }
        titleAs="h2"
        className="nx-import-card"
      >
        <p style={styles.note}>{t('importExport.formatHint')}</p>
        <div style={styles.grid}>
          <Input
            label={t('importExport.statementFile')}
            type="file"
            accept=".csv,.ofx,.qif,text/csv,application/x-ofx"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setIdempotencyKey(crypto.randomUUID());
              setMessage(null);
            }}
          />
          <Select
            label={t('importExport.account')}
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="">{t('importExport.chooseAccount')}</option>
            {accounts.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            label={t('importExport.expenseCategory')}
            value={expenseCategoryId}
            onChange={(event) => setExpenseCategoryId(event.target.value)}
          >
            <option value="">{t('importExport.chooseCategory')}</option>
            {expenseCategories.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            label={t('importExport.incomeCategory')}
            value={incomeCategoryId}
            onChange={(event) => setIncomeCategoryId(event.target.value)}
          >
            <option value="">{t('importExport.rejectPositive')}</option>
            {incomeCategories.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        {message && (
          <p role="status" style={styles.message}>
            {message}
          </p>
        )}
        <Button
          onClick={submit}
          disabled={!workspaceId}
          loading={pending}
          leadingIcon={<Upload size={16} />}
        >
          {t('importExport.stage')}
        </Button>
      </Card>

      <Card
        title={
          <span style={styles.cardTitle}>
            <FileSpreadsheet size={18} /> {t('importExport.recent')}
          </span>
        }
        titleAs="h2"
      >
        {jobs.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet size={30} />}
            title={t('importExport.none')}
            body={t('importExport.noneBody')}
          />
        ) : (
          <div style={styles.jobs}>
            {jobs.map((job) => (
              <article key={job.id} className="nf-import-job" style={styles.job}>
                <div>
                  <strong>{job.filename}</strong>
                  <small style={styles.meta}>
                    {job.format} · {new Date(job.created_at).toLocaleString(intlLocale[locale])}
                  </small>
                </div>
                <Badge
                  tone={
                    job.status === 'FAILED' ? 'danger' : job.failed_rows ? 'warning' : 'success'
                  }
                  srLabel={t('importExport.statusLabel')}
                >
                  {job.status.replaceAll('_', ' ')}
                </Badge>
                <span>
                  {t('importExport.importedCount', {
                    imported: job.imported_rows,
                    total: job.total_rows,
                  })}
                  {job.failed_rows
                    ? ` · ${t('importExport.failedCount', { failed: job.failed_rows })}`
                    : ''}
                </span>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    gap: '1rem',
    flexWrap: 'wrap',
    marginBottom: '1.5rem',
  },
  title: {
    margin: 0,
    color: 'var(--text-primary)',
    fontSize: 'clamp(1.75rem,4vw,2.25rem)',
    lineHeight: 'var(--leading-display)',
    letterSpacing: 'var(--tracking-display)',
    fontOpticalSizing: 'auto',
  },
  subtitle: {
    margin: '0.5rem 0 0',
    color: 'var(--text-secondary)',
    lineHeight: 'var(--leading-normal)',
  },
  downloads: { display: 'flex', gap: '0.5rem' },
  cardTitle: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem' },
  note: {
    color: 'var(--text-secondary)',
    lineHeight: 'var(--leading-normal)',
    fontSize: '0.8125rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(13rem,1fr))',
    gap: '0.75rem',
    margin: '1rem 0',
  },
  message: {
    padding: '0.625rem',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(16,185,129,.08)',
    color: 'var(--color-primary-200)',
    lineHeight: 'var(--leading-normal)',
  },
  jobs: { display: 'grid', gap: '0.5rem' },
  job: {
    display: 'grid',
    gridTemplateColumns: 'minmax(11rem,1fr) auto auto',
    alignItems: 'center',
    gap: '0.875rem',
    padding: '0.75rem',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
    fontSize: '0.8125rem',
  },
  meta: { display: 'block', marginTop: '0.2rem', color: 'var(--text-tertiary)' },
};
