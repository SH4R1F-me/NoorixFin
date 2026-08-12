/**
 * Shared types for the operator console.
 *
 * Split from lib/admin.ts so client components can import them
 * without pulling in the `server-only` import guard. The fetcher
 * functions stay in admin.ts (server-only); only the interfaces live here.
 */

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

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// ─── Phase 2 types ───────────────────────────────────────────────────────────

export interface RoutePerf {
  route: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  error_count: number;
}

export interface PerformanceMetrics {
  window_hours: number;
  total_requests: number;
  error_count: number;
  client_error_count: number;
  error_rate: number;
  p50: number;
  p95: number;
  p99: number;
  slowest_routes: RoutePerf[];
  by_platform: Record<string, number>;
  computed_at: string;
}

export interface ScheduledJob {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  nodename: string;
  nodeport: number;
  database: string;
  username: string;
  active: boolean;
  next_run: string | null;
}

export interface AlertState {
  alert_key: string;
  is_firing: boolean;
  last_fired_at: string | null;
  last_resolved_at: string | null;
  last_value: number | null;
  updated_at: string;
}

export interface AuthAuditEvent {
  id: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  platform: string | null;
  device_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DeviceSession {
  id: string;
  user_id: string;
  device_id: string;
  platform: 'web' | 'ios' | 'android';
  device_name: string | null;
  os_version: string | null;
  app_version: string | null;
  last_seen_at: string;
  last_ip: string | null;
  first_seen_at: string;
}

export interface AnomalyNewDevice {
  id: string;
  user_id: string;
  platform: string;
  device_name: string | null;
  first_seen_at: string;
  last_ip: string | null;
}

export interface AnomalyThrottleAbuser {
  actor_id: string;
  hit_count: number;
}

export interface Anomalies {
  new_devices: AnomalyNewDevice[];
  throttle_abusers: AnomalyThrottleAbuser[];
}
