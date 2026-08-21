'use client';

/**
 * Performance metrics view — p50/p95/p99 latency, error rate, throughput.
 *
 * Uses the shared amber admin palette (ui.tsx). No charts library; bar
 * visualisation is pure CSS to avoid a bundle hit on an already JS-heavy page.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart2, RefreshCw, CheckCircle } from 'lucide-react';
import type { PerformanceMetrics } from '../../../../lib/admin-types';
import { StatTile, Panel, Badge, EmptyState, ErrorState, T, s, formatTime } from '../../ui';
import { useLocale } from '../../../../lib/i18n/locale-provider';

const WINDOWS = [1, 6, 24, 168] as const;

function LatencyBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: 'rgba(255,255,255,0.07)',
          borderRadius: 99,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: '0.75rem', color: T.text, minWidth: 50, textAlign: 'right' }}>
        {value}ms
      </span>
    </div>
  );
}

export default function PerformanceView({
  metrics,
  error,
  windowHours,
}: {
  metrics: PerformanceMetrics | null;
  error: string | null;
  windowHours: number;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localWindow, setLocalWindow] = useState(windowHours);

  function handleWindowChange(w: number) {
    setLocalWindow(w);
    startTransition(() => {
      router.push(`?window=${w}`);
    });
  }

  function handleRefresh() {
    startTransition(() => router.refresh());
  }

  const maxP95 = metrics ? Math.max(...metrics.slowest_routes.map((r) => r.p95), 1) : 1;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '1.75rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={s.title}>
            <BarChart2
              size={22}
              style={{
                display: 'inline',
                marginRight: 8,
                verticalAlign: 'middle',
                color: T.accent,
              }}
            />
            {t('admin.performance.title')}
          </h1>
          <p style={s.subtitle}>{t('admin.performance.subtitle')}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Time window selector */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
              padding: 2,
            }}
          >
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => handleWindowChange(w)}
                style={{
                  padding: '0.25rem 0.625rem',
                  fontSize: '0.75rem',
                  fontWeight: localWindow === w ? 700 : 400,
                  background: localWindow === w ? T.accent : 'transparent',
                  color: localWindow === w ? '#000' : T.textDim,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {w === 168 ? '7d' : w === 24 ? '24h' : `${w}h`}
              </button>
            ))}
          </div>

          <button onClick={handleRefresh} disabled={pending} style={{ ...s.btnGhost }}>
            <RefreshCw
              size={14}
              style={{ animation: pending ? 'spin 1s linear infinite' : 'none' }}
            />
            Refresh
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} />}

      {!metrics && !error ? (
        <EmptyState text="No performance data for this window." />
      ) : metrics ? (
        <>
          {/* KPI tiles */}
          <div style={{ ...s.grid, marginBottom: '1.5rem' }}>
            <StatTile
              label={t('admin.performance.totalRequests')}
              value={metrics.total_requests.toLocaleString()}
              hint={`Window: ${localWindow === 168 ? '7 days' : localWindow === 24 ? '24 hours' : `${localWindow} hour${localWindow > 1 ? 's' : ''}`}`}
            />
            <StatTile
              label={t('admin.performance.errorRate')}
              value={`${metrics.error_rate.toFixed(2)}%`}
              hint={`${metrics.error_count} 5xx · ${metrics.client_error_count} 4xx`}
              tone={metrics.error_rate > 5 ? T.error : metrics.error_rate > 1 ? T.warn : T.ok}
            />
            <StatTile
              label={t('admin.performance.p50')}
              value={`${metrics.p50}ms`}
              hint="Median latency"
            />
            <StatTile
              label={t('admin.performance.p95')}
              value={`${metrics.p95}ms`}
              hint="95th percentile"
              tone={metrics.p95 > 500 ? T.error : metrics.p95 > 200 ? T.warn : T.ok}
            />
            <StatTile
              label={t('admin.performance.p99')}
              value={`${metrics.p99}ms`}
              hint="99th percentile"
              tone={metrics.p99 > 1000 ? T.error : metrics.p99 > 500 ? T.warn : T.ok}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Slowest routes */}
            <Panel
              title={t('admin.performance.slowestRoutes')}
              actions={<Badge text={String(metrics.slowest_routes.length)} color={T.textFaint} />}
              padded={false}
            >
              {metrics.slowest_routes.length === 0 ? (
                <EmptyState text="No route data for this window." />
              ) : (
                <div
                  style={s.tableWrap}
                  role="region"
                  aria-label="Slowest routes table, horizontally scrollable"
                  tabIndex={0}
                >
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th scope="col" style={s.th}>Route</th>
                        <th scope="col" style={{ ...s.th, textAlign: 'right' }}>
                          {t('admin.performance.requestCount')}
                        </th>
                        <th scope="col" style={{ ...s.th, textAlign: 'right' }}>
                          {t('admin.performance.errorCount')}
                        </th>
                        <th scope="col" style={{ ...s.th, minWidth: 180 }}>p95 latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.slowest_routes.map((r) => (
                        <tr key={r.route}>
                          <td
                            style={{
                              ...s.td,
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {r.route}
                          </td>
                          <td style={{ ...s.td, textAlign: 'right', color: T.textDim }}>
                            {r.count}
                          </td>
                          <td
                            style={{
                              ...s.td,
                              textAlign: 'right',
                              color: r.error_count > 0 ? T.error : T.textFaint,
                            }}
                          >
                            {r.error_count}
                          </td>
                          <td style={s.td}>
                            <LatencyBar
                              value={r.p95}
                              max={maxP95}
                              color={r.p95 > 500 ? T.error : r.p95 > 200 ? T.warn : T.ok}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            {/* By platform */}
            <Panel title={t('admin.performance.byPlatform')}>
              {Object.keys(metrics.by_platform).length === 0 ? (
                <EmptyState text="No platform breakdown yet." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {Object.entries(metrics.by_platform)
                    .sort(([, a], [, b]) => b - a)
                    .map(([platform, count]) => {
                      const pct =
                        metrics.total_requests === 0
                          ? 0
                          : Math.round((count / metrics.total_requests) * 100);
                      return (
                        <div key={platform}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.8125rem',
                                color: T.text,
                                textTransform: 'capitalize',
                              }}
                            >
                              {platform}
                            </span>
                            <span style={{ fontSize: '0.8125rem', color: T.textDim }}>
                              {count.toLocaleString()} ({pct}%)
                            </span>
                          </div>
                          <div
                            style={{
                              height: 6,
                              background: 'rgba(255,255,255,0.07)',
                              borderRadius: 99,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: T.accent,
                                borderRadius: 99,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}

                  <div
                    style={{
                      marginTop: '0.5rem',
                      paddingTop: '0.875rem',
                      borderTop: `1px solid ${T.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <CheckCircle size={13} color={T.ok} />
                    <span style={{ fontSize: '0.75rem', color: T.textFaint }}>
                      {t('admin.performance.computedAt')} {formatTime(metrics.computed_at)}
                    </span>
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </>
      ) : null}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
