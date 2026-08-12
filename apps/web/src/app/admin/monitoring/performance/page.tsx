/**
 * /admin/monitoring/performance
 *
 * p50/p95/p99 latency, error rate, and request throughput.
 * Fed by system_events.latency_ms via the Phase-2 backend endpoint.
 *
 * Server component: data seeded on first paint, client refresh via a
 * simple "reload" button (SSE is overkill for batch metrics).
 */
import { getPerformanceMetrics } from '../../../../lib/admin';
import PerformanceView from './performance-view';

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const sp = await searchParams;
  const windowHours = Math.max(1, Math.min(168, parseInt(sp.window ?? '1', 10) || 1));
  const result = await getPerformanceMetrics(windowHours);

  return (
    <PerformanceView
      metrics={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
      windowHours={windowHours}
    />
  );
}
