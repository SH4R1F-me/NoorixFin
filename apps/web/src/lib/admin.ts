import 'server-only';

/**
 * Server-side fetchers for the operator console (DEC-016).
 *
 * Every one of these runs on the server and forwards the operator's own access
 * token (DEC-009 — the browser holds none). The API re-checks SuperAdminGuard
 * and the database re-checks `is_super_admin()`, so nothing here is trusted to
 * be the gate; this module is a typed transport, not a security boundary.
 *
 * Note what these types do NOT contain: no balance, amount, payee, or note. The
 * console cannot display a user's finances because the layers underneath it will
 * not return them (DEC-002 #12, DEC-007).
 *
 * Types live in lib/admin-types.ts so client components can import them without
 * pulling in this server-only file.
 */
import { apiFetch, ApiError } from './api-client';
import type { ApiRuntimePath } from '@noorixfin/api-client';

// Re-export everything from admin-types.ts so existing imports from 'lib/admin'
// still work for server components.
export type {
  PlatformStats,
  HealthReport,
  SystemEvent,
  AuditEvent,
  AdminUser,
  AppSetting,
  AdminBroadcast,
  Page,
  Result,
  RoutePerf,
  PerformanceMetrics,
  ScheduledJob,
  AlertState,
  AuthAuditEvent,
  DeviceSession,
  AnomalyNewDevice,
  AnomalyThrottleAbuser,
  Anomalies,
  NotificationCampaign,
  NotificationDeliveryStats,
  NotificationTemplate,
  MobileRelease,
} from './admin-types';

import type {
  PlatformStats,
  HealthReport,
  SystemEvent,
  AuditEvent,
  AdminUser,
  AppSetting,
  AdminBroadcast,
  Page,
  Result,
  PerformanceMetrics,
  ScheduledJob,
  AlertState,
  AuthAuditEvent,
  DeviceSession,
  Anomalies,
  NotificationCampaign,
  NotificationDeliveryStats,
  NotificationTemplate,
  MobileRelease,
} from './admin-types';

// ─── Fetchers ───────────────────────────────────────────────────────────────

/**
 * A failed admin panel renders its own error state rather than collapsing the
 * whole console — an operator diagnosing an outage needs the pages that still
 * work, not a single 500 for everything.
 *
 * Returns `{ data, error }` instead of swallowing to null: on a monitoring
 * screen, "no events" and "could not load events" must not look identical.
 *
 * Discriminated on a literal `ok`, not on `error` being truthy: an error message
 * that happened to be the empty string would not narrow, and TypeScript is right
 * to refuse. `ok` makes every call site's null-check provable.
 */
async function get<T>(path: ApiRuntimePath): Promise<Result<T>> {
  try {
    return { ok: true, data: await apiFetch<T>(path) };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: `${error.code}: ${error.message}` };
    }
    return { ok: false, error: 'Unexpected error contacting the API' };
  }
}

export const getPlatformStats = () => get<PlatformStats>('/admin/overview');
export const getHealthReport = () => get<HealthReport>('/admin/health');
export const getSettings = () => get<AppSetting[]>('/admin/settings');
export const getBroadcasts = () => get<AdminBroadcast[]>('/admin/broadcasts');
export const getNotificationCampaigns = () => get<NotificationCampaign[]>('/admin/notifications');
export const getNotificationTemplates = () =>
  get<NotificationTemplate[]>('/admin/notifications/templates');
export const getNotificationDeliveryStats = (id: string) =>
  get<NotificationDeliveryStats>(`/admin/notifications/${id}/deliveries`);
export const getMobileRelease = () => get<MobileRelease>('/admin/releases');

export function getEvents(params: { level?: string; q?: string; limit?: number; offset?: number }) {
  const search = new URLSearchParams();
  if (params.level) search.set('level', params.level);
  if (params.q) search.set('q', params.q);
  search.set('limit', String(params.limit ?? 50));
  search.set('offset', String(params.offset ?? 0));
  return get<Page<SystemEvent>>(`/admin/events?${search.toString()}`);
}

export function getAudit(params: {
  action?: string;
  resourceType?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params.action) search.set('action', params.action);
  if (params.resourceType) search.set('resourceType', params.resourceType);
  search.set('limit', String(params.limit ?? 50));
  search.set('offset', String(params.offset ?? 0));
  return get<Page<AuditEvent>>(`/admin/audit?${search.toString()}`);
}

export function getUsers(params: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  query.set('limit', String(params.limit ?? 50));
  query.set('offset', String(params.offset ?? 0));
  return get<Page<AdminUser>>(`/admin/users?${query.toString()}`);
}

// ─── Phase 2: Performance metrics ───────────────────────────────────────────

export const getPerformanceMetrics = (windowHours = 1) =>
  get<PerformanceMetrics>(`/admin/metrics/performance?window=${windowHours}`);

// ─── Phase 2: Scheduled jobs ─────────────────────────────────────────────────

export const getScheduledJobs = () => get<{ jobs: ScheduledJob[]; run_at: string }>('/admin/jobs');

// ─── Phase 2: Alerts ─────────────────────────────────────────────────────────

export const getAlerts = () => get<AlertState[]>('/admin/alerts');

export async function acknowledgeAlert(alertKey: string): Promise<Result<AlertState>> {
  try {
    const data = await apiFetch<AlertState>(
      `/admin/alerts/${encodeURIComponent(alertKey)}/acknowledge`,
      {
        method: 'POST',
      },
    );
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: `${err.code}: ${err.message}` };
    return { ok: false, error: 'Unexpected error' };
  }
}

// ─── Phase 2: Security — Auth events ─────────────────────────────────────────

export function getAuthEvents(params: { platform?: string; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params.platform) q.set('platform', params.platform);
  q.set('limit', String(params.limit ?? 50));
  q.set('offset', String(params.offset ?? 0));
  return get<Page<AuthAuditEvent>>(`/admin/security/auth-events?${q.toString()}`);
}

// ─── Phase 2: Security — Active sessions ─────────────────────────────────────

export function getActiveSessions(params: { platform?: string; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params.platform) q.set('platform', params.platform);
  q.set('limit', String(params.limit ?? 50));
  q.set('offset', String(params.offset ?? 0));
  return get<Page<DeviceSession>>(`/admin/security/sessions?${q.toString()}`);
}

export async function revokeSession(deviceId: string): Promise<Result<{ revoked: boolean }>> {
  try {
    const data = await apiFetch<{ revoked: boolean }>(
      `/admin/security/sessions/${deviceId}/revoke`,
      {
        method: 'POST',
      },
    );
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: `${err.code}: ${err.message}` };
    return { ok: false, error: 'Unexpected error' };
  }
}

export async function revokeAllSessions(userId: string): Promise<Result<{ revoked: number }>> {
  try {
    const data = await apiFetch<{ revoked: number }>(
      `/admin/security/sessions/revoke-all/${userId}`,
      {
        method: 'POST',
      },
    );
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: `${err.code}: ${err.message}` };
    return { ok: false, error: 'Unexpected error' };
  }
}

// ─── Phase 2: Security — Anomalies ───────────────────────────────────────────

export const getAnomalies = () => get<Anomalies>('/admin/security/anomalies');
