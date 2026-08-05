import 'server-only';

/**
 * Active workspace resolution — DEC-007.
 *
 * Under DEC-007 a user owns exactly one PERSONAL workspace, so "active
 * workspace" is simply "their workspace". There is no switcher to build.
 *
 * A user who signed up through the app has no workspace until one is created —
 * `handle_new_user()` creates the profile only. Rather than showing an empty
 * dashboard or an error, the first dashboard load creates it. That write goes
 * through the API (DEC-005), and the database guarantees it cannot be
 * duplicated even under concurrent first loads: migration 00004 added a partial
 * unique index on one active personal workspace per user.
 */
import { apiFetch, ApiError } from './api-client';

export interface Workspace {
  id: string;
  name: string;
  base_currency: string;
  timezone: string;
  status: string;
}

export async function getActiveWorkspace(): Promise<Workspace | null> {
  let workspaces: Workspace[];
  try {
    workspaces = await apiFetch<Workspace[]>('/workspaces');
  } catch (error) {
    // Not authenticated, or the API is down. The caller renders an empty state
    // rather than crashing the whole dashboard.
    if (error instanceof ApiError) return null;
    throw error;
  }

  const active = workspaces.find((w) => w.status === 'ACTIVE');
  if (active) return active;

  try {
    return await apiFetch<Workspace>('/workspaces', {
      method: 'POST',
      body: { name: 'Personal', base_currency: 'BDT', timezone: 'Asia/Dhaka' },
    });
  } catch (error) {
    // A concurrent first load won the race; re-read rather than surfacing 409.
    if (error instanceof ApiError && error.status === 409) {
      const retry = await apiFetch<Workspace[]>('/workspaces');
      return retry.find((w) => w.status === 'ACTIVE') ?? null;
    }
    return null;
  }
}

// ─── Resource fetchers ──────────────────────────────────────────────────────
// All server-side: with httpOnly cookies the browser holds no token (DEC-009),
// so data is fetched here and passed to client components as props.

export interface AccountRow {
  id: string;
  name: string;
  class: string;
  subtype: string;
  currency_code: string;
  balance_minor?: number;
  archived_at: string | null;
}

export interface TransactionRow {
  id: string;
  entry_type: string;
  occurred_at: string;
  local_date: string;
  payee: string | null;
  note: string | null;
  status: string;
  /** Derived from the postings by the API — the entry itself carries no amount. */
  amount_minor: number;
  currency_code: string | null;
}

export interface CategoryRow {
  id: string;
  kind: string;
  translation_key: string | null;
  custom_name: string | null;
  icon: string;
  color: string;
  /** Soft-delete marker (migration 00005). Archived categories stay in the
   *  ledger for historical entries but must not be offered for new ones. */
  archived_at: string | null;
}

/** Never throws — a dashboard panel degrades to empty rather than 500ing. */
async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiFetch<T>(path);
  } catch {
    return fallback;
  }
}

export function getAccounts(workspaceId: string) {
  return safeFetch<AccountRow[]>(`/workspaces/${workspaceId}/accounts`, []);
}

export function getCategories(workspaceId: string) {
  return safeFetch<CategoryRow[]>(`/workspaces/${workspaceId}/categories`, []);
}

export async function getTransactions(workspaceId: string, limit = 50) {
  const result = await safeFetch<{ items: TransactionRow[] }>(
    `/workspaces/${workspaceId}/transactions?limit=${limit}`,
    { items: [] },
  );
  return result.items ?? [];
}

export interface WorkspaceSummary {
  visible: boolean;
  net_worth: number;
  income: number;
  expense: number;
  net: number;
  prev_income: number;
  prev_expense: number;
  prev_net: number;
  account_count: number;
  timezone?: string;
  month_start?: string;
}

/**
 * Dashboard aggregation — one round trip (DEC-011).
 *
 * Returns null on failure rather than throwing: a dashboard that cannot reach
 * the API should render zeros and its empty states, not a 500.
 */
export function apiSummary(workspaceId: string) {
  return safeFetch<WorkspaceSummary | null>(`/workspaces/${workspaceId}/summary`, null);
}

/** Display name for a category: user-supplied wins, else the translation key (DEC-015). */
export function categoryLabel(category: CategoryRow, translate?: (key: string) => string): string {
  if (category.custom_name) return category.custom_name;
  if (!category.translation_key) return 'Unnamed';
  return translate ? translate(category.translation_key) : category.translation_key;
}
