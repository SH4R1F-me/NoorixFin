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
 */
import { apiFetch, ApiError } from './api-client';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PlatformStats {
  users: {
    total: number;
    active: number;
    suspended: number;
    pending_deletion: number;
    super_admins: number;
    new_24h: number;
    new_7d: number;
    active_7d: number;
  };
  workspaces: { total: number; active: number };
  ledger: { accounts: number; entries: number; entries_24h: number };
  events: {
    total: number;
    errors_1h: number;
    errors_24h: number;
    warns_24h: number;
    oldest: string | null;
  };
  broadcasts: { published: number; draft: number };
  audit: { total: number; last_24h: number };
  generated_at: string;
  api: {
    uptime_seconds: number;
    db_latency_ms: number;
    version: string;
    node_env: string;
    telemetry_pending: number;
  };
}

export interface HealthReport {
  status: 'healthy' | 'degraded';
  checks: Array<{
    name: string;
    ok: boolean;
    latency_ms: number;
    error: string | null;
  }>;
  checked_at: string;
}

export interface SystemEvent {
  id: number;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  source: string;
  event_code: string;
  message: string;
  request_id: string | null;
  actor_id: string | null;
  route: string | null;
  method: string | null;
  status_code: number | null;
  latency_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  workspace_id: string | null;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Platform metadata and activity COUNTS. Never financial data. */
export interface AdminUser {
  user_id: string;
  email: string;
  display_name: string;
  locale: string;
  timezone: string;
  base_currency: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION';
  is_super_admin: boolean;
  onboarding_status: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  deletion_scheduled_for: string | null;
  provider_count: number;
  workspace_count: number;
  account_count: number;
  entry_count: number;
  last_entry_at: string | null;
}

export interface AppSetting {
  key: string;
  value: Record<string, unknown>;
  is_public: boolean;
  description: string;
  updated_by: string | null;
  updated_at: string;
}

export interface AdminBroadcast {
  id: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  audience: 'ALL' | 'SUPER_ADMINS';
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  title_en: string;
  title_bn: string;
  body_en: string;
  body_bn: string;
  link_url: string | null;
  dismissible: boolean;
  publish_at: string | null;
  expires_at: string | null;
  created_at: string;
  stats: { seen: number; dismissed: number };
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Fetchers ───────────────────────────────────────────────────────────────

/**
 * A failed admin panel renders its own error state rather than collapsing the
 * whole console — an operator diagnosing an outage needs the pages that still
 * work, not a single 500 for everything.
 *
 * Returns `{ data, error }` instead of swallowing to null: on a monitoring
 * screen, "no events" and "could not load events" must not look identical.
 */
/**
 * Discriminated on a literal `ok`, not on `error` being truthy: an error message
 * that happened to be the empty string would not narrow, and TypeScript is right
 * to refuse. `ok` makes every call site's null-check provable.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function get<T>(path: string): Promise<Result<T>> {
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

export function getEvents(params: {
  level?: string;
  q?: string;
  limit?: number;
  offset?: number;
}) {
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
