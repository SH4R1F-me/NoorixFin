'use server';

/**
 * Planning writes — budgets, goals, debts, calendar events.
 *
 * Same shape as ledger-actions.ts: a plain result object rather than a thrown
 * error, so a form can render an inline message without a redirect, and every
 * write goes through NestJS (DEC-005) rather than touching Supabase from the
 * browser — which under DEC-009 it could not do anyway, since the token is
 * httpOnly.
 *
 * ── ON AMOUNTS ───────────────────────────────────────────────────────────────
 * Forms produce human strings ("2,000.50"); the API takes MINOR units as digit
 * strings (§8.1, DEC-004). `toMinorUnits` applies the currency's real exponent,
 * so this is correct for JPY (0) and KWD (3) too, not just /100.
 */
import { revalidatePath } from 'next/cache';
import { toMinorUnits } from '@noorixfin/money';
import { apiFetch, ApiError } from '../../lib/api-client';

export type PlanningResult = { ok: true } | { ok: false; message: string };

function fail(error: unknown): PlanningResult {
  if (error instanceof ApiError) return { ok: false, message: error.message };
  return { ok: false, message: 'Could not reach the API. Nothing was saved.' };
}

/**
 * Parse a human amount to minor units.
 *
 * `allowZero` exists because the two callers genuinely differ: a budget limit
 * of zero is meaningless, but an expected-income event of zero is a legitimate
 * "remind me, amount unknown".
 */
function toMinor(
  input: string,
  currency: string,
  { allowZero = false } = {},
): { ok: true; value: string } | { ok: false; message: string } {
  const cleaned = input.trim().replace(/,/g, '');
  if (cleaned === '') return { ok: false, message: 'Enter an amount.' };

  const major = Number(cleaned);
  if (!Number.isFinite(major)) return { ok: false, message: 'That is not a valid amount.' };
  if (major < 0) return { ok: false, message: 'Amount cannot be negative.' };
  if (!allowZero && major === 0) {
    return { ok: false, message: 'Amount must be greater than zero.' };
  }

  const minor = toMinorUnits(major, currency);
  if (!Number.isSafeInteger(minor)) {
    return { ok: false, message: 'That amount is too large.' };
  }
  // A STRING, not a number: a JSON number is a double, and the whole point of
  // minor units is to never let a balance touch floating point.
  return { ok: true, value: String(minor) };
}

function revalidatePlanning() {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/budgets');
  revalidatePath('/dashboard/calendar');
  revalidatePath('/dashboard/goals');
  revalidatePath('/dashboard/reports');
}

// ─── Budgets ────────────────────────────────────────────────────────────────

export interface BudgetLineInput {
  categoryId: string;
  /** Human string from the form, e.g. "2000.50". */
  amount: string;
  alertThresholdPct?: number;
}

export async function saveBudget(input: {
  workspaceId: string;
  currency: string;
  name?: string;
  rollover?: boolean;
  lines: BudgetLineInput[];
}): Promise<PlanningResult> {
  const lines: { category_id: string; planned_minor: string; alert_threshold_pct?: number }[] = [];

  for (const line of input.lines) {
    // Blank rows are how a user removes a line from the form, not an error.
    if (!line.categoryId || line.amount.trim() === '') continue;

    const parsed = toMinor(line.amount, input.currency);
    if (!parsed.ok) return parsed;

    lines.push({
      category_id: line.categoryId,
      planned_minor: parsed.value,
      ...(line.alertThresholdPct !== undefined
        ? { alert_threshold_pct: line.alertThresholdPct }
        : {}),
    });
  }

  // Two rows for the same category would violate the UNIQUE (budget_id,
  // category_id) index and come back as a raw 23505. Catching it here names the
  // actual mistake instead.
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.category_id)) {
      return { ok: false, message: 'Each category can only have one limit.' };
    }
    seen.add(line.category_id);
  }

  try {
    // PUT, not POST: the body is the whole line set and replaces what is there.
    await apiFetch(`/workspaces/${input.workspaceId}/budget`, {
      method: 'PUT',
      body: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.rollover !== undefined ? { rollover: input.rollover } : {}),
        lines,
      },
    });
    revalidatePlanning();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ─── Savings goals ──────────────────────────────────────────────────────────

export async function createGoal(input: {
  workspaceId: string;
  currency: string;
  name: string;
  target: string;
  targetDate?: string;
  linkedAccountId?: string;
}): Promise<PlanningResult> {
  if (!input.name.trim()) return { ok: false, message: 'Give the goal a name.' };

  const parsed = toMinor(input.target, input.currency);
  if (!parsed.ok) return parsed;

  try {
    await apiFetch(`/workspaces/${input.workspaceId}/goals`, {
      method: 'POST',
      body: {
        name: input.name.trim(),
        target_minor: parsed.value,
        currency_code: input.currency,
        ...(input.targetDate ? { target_date: input.targetDate } : {}),
        // Optional on purpose: an unlinked goal reports null progress, which the
        // UI shows as "link an account" rather than as "you have saved nothing".
        ...(input.linkedAccountId ? { linked_account_id: input.linkedAccountId } : {}),
      },
    });
    revalidatePlanning();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteGoal(workspaceId: string, goalId: string): Promise<PlanningResult> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/goals/${goalId}`, { method: 'DELETE' });
    revalidatePlanning();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ─── Debt terms ─────────────────────────────────────────────────────────────

export async function saveDebtTerms(input: {
  workspaceId: string;
  currency: string;
  ledgerAccountId: string;
  principal: string;
  /** Percent as the user types it ("9.5"), converted to basis points here. */
  annualRatePercent?: string;
  minimumPayment?: string;
  dueDay?: number;
}): Promise<PlanningResult> {
  const principal = toMinor(input.principal, input.currency);
  if (!principal.ok) return principal;

  let rateBps: number | undefined;
  if (input.annualRatePercent?.trim()) {
    const percent = Number(input.annualRatePercent.trim());
    if (!Number.isFinite(percent) || percent < 0) {
      return { ok: false, message: 'That is not a valid interest rate.' };
    }
    // Basis points, rounded to an integer: a rate that gets compounded must not
    // be a float, for the same reason an amount must not be (DEC-004).
    rateBps = Math.round(percent * 100);
  }

  let minimum: string | undefined;
  if (input.minimumPayment?.trim()) {
    const parsed = toMinor(input.minimumPayment, input.currency, { allowZero: true });
    if (!parsed.ok) return parsed;
    minimum = parsed.value;
  }

  try {
    await apiFetch(`/workspaces/${input.workspaceId}/debts`, {
      method: 'PUT',
      body: {
        ledger_account_id: input.ledgerAccountId,
        principal_minor: principal.value,
        ...(rateBps !== undefined ? { annual_rate_bps: rateBps } : {}),
        ...(minimum !== undefined ? { minimum_payment_minor: minimum } : {}),
        ...(input.dueDay !== undefined ? { due_day: input.dueDay } : {}),
      },
    });
    revalidatePlanning();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ─── Calendar ───────────────────────────────────────────────────────────────

export async function createCalendarEvent(input: {
  workspaceId: string;
  currency: string;
  type: 'BILL' | 'INCOME' | 'CUSTOM';
  title: string;
  amount?: string;
  dueDate: string;
}): Promise<PlanningResult> {
  if (!input.title.trim()) return { ok: false, message: 'Give it a name.' };
  if (!input.dueDate) return { ok: false, message: 'Choose a due date.' };

  let amount: string | undefined;
  if (input.amount?.trim()) {
    const parsed = toMinor(input.amount, input.currency, { allowZero: true });
    if (!parsed.ok) return parsed;
    amount = parsed.value;
  }

  try {
    await apiFetch(`/workspaces/${input.workspaceId}/calendar`, {
      method: 'POST',
      body: {
        type: input.type,
        title: input.title.trim(),
        ...(amount !== undefined ? { amount_minor: amount } : {}),
        currency_code: input.currency,
        due_date: input.dueDate,
      },
    });
    revalidatePlanning();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setCalendarEventStatus(
  workspaceId: string,
  eventId: string,
  status: 'UPCOMING' | 'PAID' | 'SKIPPED',
): Promise<PlanningResult> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/calendar/${eventId}`, {
      method: 'PATCH',
      body: { status },
    });
    revalidatePlanning();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteCalendarEvent(
  workspaceId: string,
  eventId: string,
): Promise<PlanningResult> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/calendar/${eventId}`, { method: 'DELETE' });
    revalidatePlanning();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ── Recurring rules (§2.3) ──────────────────────────────────────────────────

/**
 * Create a recurring rule.
 *
 * ── WHAT A RULE IS, AND IS NOT ──────────────────────────────────────────────
 * A template held as DATA, never as a draft journal entry. §9.4 is explicit
 * that nothing auto-posts an entry the user has not confirmed, and the schema
 * enforces it: the strongest `behavior` available is `AUTO_CREATE_DRAFT`, and a
 * DRAFT is excluded from every aggregation in this database.
 *
 * That constraint is the reason the UI says "reminder" rather than "automatic
 * payment". A user who believes their rent is being paid automatically, because
 * an app implied it, finds out at the wrong moment.
 */
export async function createRecurringRule(input: {
  workspaceId: string;
  name: string;
  entryType: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  amount: string;
  currency: string;
  accountId?: string;
  categoryId?: string;
  payee?: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  intervalCount?: number;
  nextOccurrence: string;
  endsAt?: string;
  behavior?: 'REMIND_ONLY' | 'AUTO_CREATE_DRAFT';
}): Promise<PlanningResult> {
  const minor = toMinor(input.amount, input.currency);
  if (!minor.ok) return minor;
  if (!input.name.trim()) return { ok: false, message: 'Give the rule a name.' };
  if (!input.nextOccurrence) return { ok: false, message: 'Choose the next date.' };

  // Caught here rather than left to a CHECK violation: `ends_at` before
  // `next_occurrence` describes a rule that can never fire, and "violates
  // constraint chk_recurring_window" is not a sentence anyone can act on.
  if (input.endsAt && input.endsAt < input.nextOccurrence) {
    return { ok: false, message: 'The end date cannot be before the next occurrence.' };
  }

  try {
    await apiFetch(`/workspaces/${input.workspaceId}/recurring`, {
      method: 'POST',
      body: {
        name: input.name.trim(),
        entry_type: input.entryType,
        amount_minor: minor.value,
        currency_code: input.currency,
        ...(input.accountId ? { account_id: input.accountId } : {}),
        ...(input.categoryId ? { category_id: input.categoryId } : {}),
        ...(input.payee?.trim() ? { payee: input.payee.trim() } : {}),
        frequency: input.frequency,
        ...(input.intervalCount ? { interval_count: input.intervalCount } : {}),
        next_occurrence: input.nextOccurrence,
        ...(input.endsAt ? { ends_at: input.endsAt } : {}),
        ...(input.behavior ? { behavior: input.behavior } : {}),
      },
    });
    revalidatePlanning();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Delete a recurring rule.
 *
 * Removes a TEMPLATE. Any entry it already produced is an ordinary journal
 * entry and is untouched — deleting the rule that suggested a payment must
 * never unmake the payment.
 */
export async function deleteRecurringRule(
  workspaceId: string,
  ruleId: string,
): Promise<PlanningResult> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/recurring/${ruleId}`, {
      method: 'DELETE',
    });
    revalidatePlanning();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
