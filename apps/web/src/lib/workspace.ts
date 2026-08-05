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
  /**
   * True when a REVERSAL entry points at this one (FIN-03).
   *
   * Derived by the API per page, never stored: the original stays POSTED and
   * the mirror cancels it, so "corrected" is a fact about the ledger rather
   * than a status that could drift from it.
   */
  reversed?: boolean;
  /** Tag names carried by this entry, alphabetical. Empty, never absent. */
  tags?: string[];
  currency_code: string | null;
  /**
   * Every ledger account this entry posted against.
   *
   * A posting references a category's BACKING ledger account, never the
   * category id (DEC-015), so this is the only link back to a category — and
   * matching it against the already-fetched category list costs no extra query.
   */
  ledger_account_ids?: string[];
}

export interface CategoryRow {
  id: string;
  kind: string;
  /** The category's backing ledger account — what postings actually reference. */
  ledger_account_id: string;
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

/**
 * @param categoryId Drill-down filter (§5.3). When set, only entries that
 *   posted against that category are returned — this is what makes a budget
 *   line or a report slice lead to the transactions behind it, rather than
 *   being a dead number.
 */
export interface TagRow {
  id: string;
  name: string;
  /** How many entries carry it — what distinguishes a live tag from a typo. */
  usage_count: number;
}

/** Every tag in the workspace, alphabetical, with usage counts (§6.3). */
export async function getTags(workspaceId: string) {
  return safeFetch<TagRow[]>(`/workspaces/${workspaceId}/tags`, []);
}

export async function getTransactions(
  workspaceId: string,
  limit = 50,
  categoryId?: string,
  tagId?: string,
) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (categoryId) query.set('category', categoryId);
  if (tagId) query.set('tag', tagId);

  const result = await safeFetch<{ items: TransactionRow[] }>(
    `/workspaces/${workspaceId}/transactions?${query.toString()}`,
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

// ─── Planning (§9.4) ────────────────────────────────────────────────────────
//
// Each of these is ONE aggregation RPC behind ONE endpoint (DEC-011). The
// alternative — fetching budget lines, then categories, then postings, and
// summing in the browser — would be a second implementation of ledger
// arithmetic that has to agree with Postgres forever.
//
// Every "spent", "progress" and "outstanding" figure below is DERIVED
// server-side from postings. None of them is a stored total, so none can drift
// from the ledger (DEC-022).

export interface BudgetLine {
  line_id: string;
  category_id: string;
  /** Pre-resolved fallback. Prefer translating `translation_key` when present. */
  name: string;
  translation_key: string | null;
  custom_name: string | null;
  icon: string;
  color: string;
  planned_minor: number;
  spent_minor: number;
  remaining_minor: number;
  alert_threshold_pct: number;
}

export interface BudgetStatus {
  visible: boolean;
  has_budget?: boolean;
  budget_id?: string;
  name?: string;
  cadence?: 'MONTHLY' | 'WEEKLY';
  rollover?: boolean;
  period_start?: string;
  period_end?: string;
  timezone?: string;
  generated_at?: string;
  lines?: BudgetLine[];
  planned_total?: number;
  spent_total?: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_minor: number;
  currency_code: string;
  target_date: string | null;
  status: string;
  priority: number;
  linked_account_id: string | null;
  /** null — not zero — when no account is linked. The two mean different things. */
  current_minor: number | null;
  days_left: number | null;
}

export interface DebtSummary {
  ledger_account_id: string;
  name: string;
  currency_code: string;
  principal_minor: number;
  annual_rate_bps: number | null;
  minimum_payment_minor: number | null;
  due_day: number | null;
  outstanding_minor: number;
}

export interface GoalsOverview {
  visible: boolean;
  goals?: SavingsGoal[];
  debts?: DebtSummary[];
  total_debt_minor?: number;
  generated_at?: string;
}

export interface CalendarEvent {
  id: string;
  type: 'BILL' | 'INCOME' | 'GOAL' | 'CUSTOM';
  title: string;
  amount_minor: number | null;
  currency_code: string | null;
  due_at: string;
  local_date: string;
  /** OVERDUE and DUE are computed from today; only the other three are stored. */
  status: 'UPCOMING' | 'DUE' | 'OVERDUE' | 'PAID' | 'SKIPPED';
  days_away: number;
  journal_entry_id: string | null;
  recurring_rule_id: string | null;
}

export interface CalendarOverview {
  visible: boolean;
  today?: string;
  horizon_days?: number;
  events?: CalendarEvent[];
  overdue_count?: number;
  due_soon_total_minor?: number;
  generated_at?: string;
}

export interface ReportCategory {
  category_id: string;
  translation_key: string | null;
  custom_name: string | null;
  icon: string;
  color: string;
  kind: 'INCOME' | 'EXPENSE';
  amount_minor: number;
  entry_count: number;
}

export interface CategoryReport {
  visible: boolean;
  /** §11.3 requires these on every report — without them a screenshot is uninterpretable. */
  period_from?: string;
  period_to?: string;
  timezone?: string;
  currency_basis?: string;
  generated_at?: string;
  categories?: ReportCategory[];
  trend?: { month: string; income_minor: number; expense_minor: number }[];
}

const NOT_VISIBLE = { visible: false } as const;

export function getBudgetStatus(workspaceId: string) {
  return safeFetch<BudgetStatus>(`/workspaces/${workspaceId}/budget`, NOT_VISIBLE);
}

export function getGoalsOverview(workspaceId: string) {
  return safeFetch<GoalsOverview>(`/workspaces/${workspaceId}/goals`, NOT_VISIBLE);
}

export function getCalendarOverview(workspaceId: string, days = 30) {
  return safeFetch<CalendarOverview>(
    `/workspaces/${workspaceId}/calendar?days=${days}`,
    NOT_VISIBLE,
  );
}

export function getCategoryReport(workspaceId: string, from?: string, to?: string) {
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return safeFetch<CategoryReport>(
    `/workspaces/${workspaceId}/reports/categories${suffix}`,
    NOT_VISIBLE,
  );
}

/** Display name for a category: user-supplied wins, else the translation key (DEC-015). */
export function categoryLabel(category: CategoryRow, translate?: (key: string) => string): string {
  if (category.custom_name) return category.custom_name;
  if (!category.translation_key) return 'Unnamed';
  return translate ? translate(category.translation_key) : category.translation_key;
}
