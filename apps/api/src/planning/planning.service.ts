/**
 * Planning Service — Blueprint §9.4, §11.3.
 *
 * Backs the four routes that were stubs: /budgets, /calendar, /goals, /reports.
 *
 * ── READS GO THROUGH RPCs, WRITES GO THROUGH TABLES ──────────────────────────
 * Every screen here needs planned-vs-actual, and "actual" is a sum over
 * journal_postings. Doing that in TypeScript would mean shipping a user's whole
 * posting history to the API to add it up — the exact pattern DEC-011 rule 6
 * exists to prevent, and a second implementation of ledger arithmetic that must
 * agree with Postgres forever. So reads call the SECURITY INVOKER aggregations
 * from migration 00016 and return one payload per screen.
 *
 * Writes use the ordinary user client so RLS applies. There is no service-role
 * path in this file at all: planning rows are financial data, and DEC-016
 * confines the operator console to metadata.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import type { Database, Json, Updatable } from '@noorixfin/db-types';
import { SupabaseService } from '../supabase/supabase.service';
import type { TypedSupabaseClient } from '../supabase/supabase.service';
import type {
  CreateCalendarEventDto,
  CreateGoalDto,
  CreateRecurringRuleDto,
  UpdateCalendarEventDto,
  UpdateGoalDto,
  UpsertBudgetDto,
  UpsertDebtDto,
  ReportRangeDto,
} from './dto/planning.dto';

/**
 * The read-side aggregations from migration 00016, all SECURITY INVOKER.
 *
 * Named as a union rather than left as `string` so `rpc()` below can type its
 * arguments against the generated function map.
 */
type PlanningFunction =
  | 'budget_status'
  | 'calendar_overview'
  | 'goals_overview'
  | 'category_report'
  | 'cash_flow_report'
  | 'net_worth_report';

/** Postgres foreign-key violation — a referenced row is not visible or gone. */
const FK_VIOLATION = '23503';
/** Postgres check-constraint violation. */
const CHECK_VIOLATION = '23514';

@Injectable()
export class PlanningService {
  private readonly logger = new Logger(PlanningService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * `TypedSupabaseClient`, not the bare `SupabaseClient`.
   *
   * Without the schema generic every `.from(...)` in this file returned `any`,
   * so a mistyped column or a table that does not exist compiled cleanly and
   * failed at runtime.
   */
  private client(accessToken: string): TypedSupabaseClient {
    return this.supabase.getUserClient(accessToken);
  }

  /**
   * Turn a Postgres error into an HTTP answer that says something true.
   *
   * A raw 500 for "you referenced a category that is not yours" is both wrong
   * and unhelpful: RLS hid the row, so it is a 400 about the request, not a
   * fault in the server.
   */
  /**
   * The row count is the only way to tell "deleted" from "not yours".
   *
   * ── THE BUG THIS EXISTS TO STOP ─────────────────────────────────────────
   * All four planning deletes returned `{ deleted: true }` unconditionally.
   * RLS does not raise on a row you cannot see — it filters it out, so a
   * DELETE against another workspace's row succeeds and affects nothing.
   * Measured: deleting another user's recurring rule returned **200** while
   * the rule survived.
   *
   * The tenant boundary held; the REPORT was wrong, which is its own kind of
   * failure. A user told a thing is gone stops looking for it, and an
   * operator debugging "the delete does not work" has been handed a success.
   *
   * `.select('id')` makes the affected rows observable, and zero is a 404.
   */
  private assertDeleted(rows: { id: string }[] | null, what: string): void {
    if (!rows || rows.length === 0) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `That ${what.toLowerCase()} does not exist in this workspace.`,
      });
    }
  }

  private fail(error: PostgrestError, what: string): never {
    if (error.code === FK_VIOLATION) {
      throw new BadRequestException({
        code: 'INVALID_REFERENCE',
        message: `${what} references something that does not exist in this workspace.`,
      });
    }
    if (error.code === CHECK_VIOLATION) {
      throw new BadRequestException({
        code: 'INVALID_VALUE',
        message: `${what} contains a value the ledger does not allow.`,
      });
    }
    this.logger.error(`${what} failed: ${error.code} ${error.message}`);
    throw new BadRequestException({
      code: 'PLANNING_WRITE_FAILED',
      message: error.message,
    });
  }

  /**
   * Parse a minor-unit string to a safe integer.
   *
   * The DTO regex already guarantees digits, so this is the second half of the
   * DEC-004 guarantee: a value that survives validation but exceeds
   * Number.MAX_SAFE_INTEGER would be silently rounded on its way into JSON, and
   * a rounded balance is worse than a rejected request.
   */
  private minor(value: string, field: string): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      throw new BadRequestException({
        code: 'AMOUNT_TOO_LARGE',
        message: `${field} is outside the range this system can represent exactly.`,
      });
    }
    return parsed;
  }

  /**
   * Call one of the 00016 aggregations.
   *
   * `fn` is a KEY of the generated function map, not a `string`. That
   * distinction is the whole point: with a plain string, supabase-js falls back
   * to its untyped overload and every aggregation on this screen came back as
   * `any` — so a misspelled function name, a wrong argument name, or a renamed
   * SQL function would all have failed at runtime with a 404 from PostgREST.
   * Now each is a compile error, and `data` arrives as `Json` rather than `any`.
   */
  private async rpc<F extends PlanningFunction>(
    accessToken: string,
    fn: F,
    args: Database['public']['Functions'][F]['Args'],
  ): Promise<Json> {
    const { data, error } = await this.client(accessToken).rpc(fn, args);
    if (error) {
      this.logger.error(`${fn} failed: ${error.code} ${error.message}`);
      throw new BadRequestException({
        code: 'AGGREGATION_FAILED',
        message: error.message,
      });
    }
    return data;
  }

  // ── Budgets ────────────────────────────────────────────────────────────────

  getBudgetStatus(workspaceId: string, accessToken: string) {
    return this.rpc(accessToken, 'budget_status', {
      p_workspace_id: workspaceId,
    });
  }

  /**
   * Create or replace the workspace's budget and all of its lines.
   *
   * Replace-whole rather than patch-per-line: the budget screen edits its lines
   * as one set, and applying them individually would let a half-failed save
   * leave a budget describing two different intentions. Deleting lines that
   * were dropped is the point of the operation, not a side effect.
   */
  async upsertBudget(
    workspaceId: string,
    userId: string,
    accessToken: string,
    dto: UpsertBudgetDto,
  ) {
    const client = this.client(accessToken);
    const cadence = dto.cadence ?? 'MONTHLY';

    const { data: existing } = await client
      .from('budgets')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('cadence', cadence)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    let budgetId: string;

    if (existing?.id) {
      budgetId = existing.id;
      const { error } = await client
        .from('budgets')
        .update({
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.rollover !== undefined ? { rollover: dto.rollover } : {}),
        })
        .eq('id', budgetId);
      if (error) this.fail(error, 'Budget');
    } else {
      const { data: created, error } = await client
        .from('budgets')
        .insert({
          workspace_id: workspaceId,
          name: dto.name ?? '',
          cadence,
          // Anchored to today. Later periods are derived from cadence rather
          // than stored, so this is the only period boundary that ever needs
          // recording.
          period_start: new Date().toISOString().slice(0, 10),
          rollover: dto.rollover ?? false,
          created_by: userId,
        })
        .select('id')
        .single();
      if (error) this.fail(error, 'Budget');
      budgetId = created.id;
    }

    // Rewrite the line set. Safe to delete first: budget_lines holds no
    // financial history — "spent" is computed from postings every time it is
    // read (DEC-022), so nothing is lost that cannot be recomputed.
    const { error: clearError } = await client
      .from('budget_lines')
      .delete()
      .eq('budget_id', budgetId);
    if (clearError) this.fail(clearError, 'Budget lines');

    if (dto.lines.length > 0) {
      const rows = dto.lines.map((line) => ({
        budget_id: budgetId,
        workspace_id: workspaceId,
        category_id: line.category_id,
        planned_minor: this.minor(line.planned_minor, 'planned_minor'),
        alert_threshold_pct: line.alert_threshold_pct ?? 80,
      }));
      const { error } = await client.from('budget_lines').insert(rows);
      if (error) this.fail(error, 'Budget lines');
    }

    return this.getBudgetStatus(workspaceId, accessToken);
  }

  async deleteBudget(
    workspaceId: string,
    accessToken: string,
    budgetId: string,
  ) {
    const { data, error } = await this.client(accessToken)
      .from('budgets')
      .delete()
      .eq('id', budgetId)
      .eq('workspace_id', workspaceId)
      .select('id');
    if (error) this.fail(error, 'Budget');
    this.assertDeleted(data, 'Budget');
    return { deleted: true };
  }

  // ── Goals and debts ────────────────────────────────────────────────────────

  getGoalsOverview(workspaceId: string, accessToken: string) {
    return this.rpc(accessToken, 'goals_overview', {
      p_workspace_id: workspaceId,
    });
  }

  async createGoal(
    workspaceId: string,
    userId: string,
    accessToken: string,
    dto: CreateGoalDto,
  ) {
    const { data, error } = await this.client(accessToken)
      .from('savings_goals')
      .insert({
        workspace_id: workspaceId,
        name: dto.name,
        target_minor: this.minor(dto.target_minor, 'target_minor'),
        currency_code: dto.currency_code ?? 'BDT',
        target_date: dto.target_date ?? null,
        linked_account_id: dto.linked_account_id ?? null,
        priority: dto.priority ?? 0,
        created_by: userId,
      })
      .select()
      .single();
    if (error) this.fail(error, 'Goal');
    return data;
  }

  async updateGoal(
    workspaceId: string,
    accessToken: string,
    goalId: string,
    dto: UpdateGoalDto,
  ) {
    const patch: Updatable<'savings_goals'> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.target_minor !== undefined)
      patch.target_minor = this.minor(dto.target_minor, 'target_minor');
    if (dto.target_date !== undefined) patch.target_date = dto.target_date;
    if (dto.linked_account_id !== undefined)
      patch.linked_account_id = dto.linked_account_id;
    if (dto.priority !== undefined) patch.priority = dto.priority;
    if (dto.status !== undefined) patch.status = dto.status;

    // NOTE: there is no `current_minor` to patch, by design. Progress is the
    // linked account's balance (§9.4). A goal that could be edited to read 90%
    // while the account holds nothing is a lie the API should not accept.

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_PATCH',
        message: 'Nothing to update.',
      });
    }

    const { data, error } = await this.client(accessToken)
      .from('savings_goals')
      .update(patch)
      .eq('id', goalId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();
    if (error) this.fail(error, 'Goal');
    if (!data)
      throw new NotFoundException({
        code: 'GOAL_NOT_FOUND',
        message: 'Goal not found',
      });
    return data;
  }

  async deleteGoal(workspaceId: string, accessToken: string, goalId: string) {
    const { data, error } = await this.client(accessToken)
      .from('savings_goals')
      .delete()
      .eq('id', goalId)
      .eq('workspace_id', workspaceId)
      .select('id');
    if (error) this.fail(error, 'Goal');
    this.assertDeleted(data, 'Goal');
    return { deleted: true };
  }

  /**
   * Attach or replace repayment terms on a LIABILITY account.
   *
   * The account class is checked here rather than left to a constraint: putting
   * loan terms on a savings account is a mistake worth a sentence, and the
   * schema cannot express "primary key must reference a row whose class column
   * says LIABILITY" without a trigger.
   */
  async upsertDebt(
    workspaceId: string,
    accessToken: string,
    dto: UpsertDebtDto,
  ) {
    const client = this.client(accessToken);

    const { data: account } = await client
      .from('ledger_accounts')
      .select('id, class')
      .eq('id', dto.ledger_account_id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!account) {
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'That account does not exist in this workspace.',
      });
    }
    if ((account as { class: string }).class !== 'LIABILITY') {
      throw new BadRequestException({
        code: 'NOT_A_LIABILITY',
        message: 'Debt terms can only be attached to a liability account.',
      });
    }

    const { data, error } = await client
      .from('debt_details')
      .upsert(
        {
          ledger_account_id: dto.ledger_account_id,
          workspace_id: workspaceId,
          principal_minor: this.minor(dto.principal_minor, 'principal_minor'),
          annual_rate_bps: dto.annual_rate_bps ?? null,
          minimum_payment_minor:
            dto.minimum_payment_minor !== undefined
              ? this.minor(dto.minimum_payment_minor, 'minimum_payment_minor')
              : null,
          due_day: dto.due_day ?? null,
        },
        { onConflict: 'ledger_account_id' },
      )
      .select()
      .single();
    if (error) this.fail(error, 'Debt terms');
    return data;
  }

  // ── Calendar ───────────────────────────────────────────────────────────────

  getCalendarOverview(workspaceId: string, accessToken: string, days = 30) {
    return this.rpc(accessToken, 'calendar_overview', {
      p_workspace_id: workspaceId,
      p_days: days,
    });
  }

  async createCalendarEvent(
    workspaceId: string,
    userId: string,
    accessToken: string,
    dto: CreateCalendarEventDto,
  ) {
    const client = this.client(accessToken);

    // The workspace's timezone decides what "due on the 10th" means. A bill due
    // 1 Aug in Dhaka is 31 Jul in UTC, and getting this from the server's clock
    // would put it on the wrong day for every user outside UTC (TIME-01).
    const { data: workspace } = await client
      .from('workspaces')
      .select('timezone, base_currency')
      .eq('id', workspaceId)
      .single();

    const timezone =
      (workspace as { timezone?: string } | null)?.timezone ?? 'Asia/Dhaka';
    const localDate = dto.due_date.slice(0, 10);

    const { data, error } = await client
      .from('calendar_events')
      .insert({
        workspace_id: workspaceId,
        type: dto.type,
        title: dto.title,
        amount_minor:
          dto.amount_minor !== undefined
            ? this.minor(dto.amount_minor, 'amount_minor')
            : null,
        currency_code:
          dto.currency_code ??
          (workspace as { base_currency?: string } | null)?.base_currency ??
          'BDT',
        // Noon local, not midnight: a due date rendered in a neighbouring
        // timezone should not slip to the previous day, and no part of the
        // product needs a bill's time of day to be meaningful.
        due_at: new Date(`${localDate}T12:00:00Z`).toISOString(),
        timezone,
        local_date: localDate,
        reminder_offsets: dto.reminder_offsets ?? [],
        created_by: userId,
      })
      .select()
      .single();
    if (error) this.fail(error, 'Calendar event');
    return data;
  }

  async updateCalendarEvent(
    workspaceId: string,
    accessToken: string,
    eventId: string,
    dto: UpdateCalendarEventDto,
  ) {
    const patch: Updatable<'calendar_events'> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.amount_minor !== undefined)
      patch.amount_minor = this.minor(dto.amount_minor, 'amount_minor');
    if (dto.due_date !== undefined) {
      const localDate = dto.due_date.slice(0, 10);
      patch.local_date = localDate;
      patch.due_at = new Date(`${localDate}T12:00:00Z`).toISOString();
    }
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.journal_entry_id !== undefined)
      patch.journal_entry_id = dto.journal_entry_id;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_PATCH',
        message: 'Nothing to update.',
      });
    }

    const { data, error } = await this.client(accessToken)
      .from('calendar_events')
      .update(patch)
      .eq('id', eventId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();
    if (error) this.fail(error, 'Calendar event');
    if (!data) {
      throw new NotFoundException({
        code: 'EVENT_NOT_FOUND',
        message: 'Event not found',
      });
    }
    return data;
  }

  async deleteCalendarEvent(
    workspaceId: string,
    accessToken: string,
    eventId: string,
  ) {
    const { data, error } = await this.client(accessToken)
      .from('calendar_events')
      .delete()
      .eq('id', eventId)
      .eq('workspace_id', workspaceId)
      .select('id');
    if (error) this.fail(error, 'Calendar event');
    this.assertDeleted(data, 'Calendar event');
    return { deleted: true };
  }

  // ── Recurring rules ────────────────────────────────────────────────────────

  async listRecurringRules(workspaceId: string, accessToken: string) {
    const { data, error } = await this.client(accessToken)
      .from('recurring_rules')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('next_occurrence', { ascending: true });
    if (error) this.fail(error, 'Recurring rules');
    return data ?? [];
  }

  async createRecurringRule(
    workspaceId: string,
    userId: string,
    accessToken: string,
    dto: CreateRecurringRuleDto,
  ) {
    const client = this.client(accessToken);
    const { data: workspace } = await client
      .from('workspaces')
      .select('timezone, base_currency')
      .eq('id', workspaceId)
      .single();

    const { data, error } = await client
      .from('recurring_rules')
      .insert({
        workspace_id: workspaceId,
        name: dto.name,
        entry_type: dto.entry_type,
        amount_minor: this.minor(dto.amount_minor, 'amount_minor'),
        currency_code:
          dto.currency_code ??
          (workspace as { base_currency?: string } | null)?.base_currency ??
          'BDT',
        account_id: dto.account_id ?? null,
        category_id: dto.category_id ?? null,
        payee: dto.payee ?? null,
        frequency: dto.frequency,
        interval_count: dto.interval_count ?? 1,
        timezone:
          (workspace as { timezone?: string } | null)?.timezone ?? 'Asia/Dhaka',
        next_occurrence: dto.next_occurrence.slice(0, 10),
        ends_at: dto.ends_at?.slice(0, 10) ?? null,
        behavior: dto.behavior ?? 'REMIND_ONLY',
        created_by: userId,
      })
      .select()
      .single();
    if (error) this.fail(error, 'Recurring rule');
    return data;
  }

  async deleteRecurringRule(
    workspaceId: string,
    accessToken: string,
    ruleId: string,
  ) {
    const { data, error } = await this.client(accessToken)
      .from('recurring_rules')
      .delete()
      .eq('id', ruleId)
      .eq('workspace_id', workspaceId)
      .select('id');
    if (error) this.fail(error, 'Recurring rule');
    this.assertDeleted(data, 'Recurring rule');
    return { deleted: true };
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  getCategoryReport(
    workspaceId: string,
    accessToken: string,
    from?: string,
    to?: string,
  ) {
    return this.rpc(accessToken, 'category_report', {
      p_workspace_id: workspaceId,
      // Omitted rather than sent as null. Both parameters carry DEFAULT NULL in
      // SQL and `category_report` has exactly one signature, so there is no
      // overload for PostgREST to pick between — omission and an explicit null
      // reach the function as the same value, and the generated Args type
      // (`p_from?: string`) says so.
      ...(from ? { p_from: from } : {}),
      ...(to ? { p_to: to } : {}),
    });
  }

  getCashFlowReport(
    workspaceId: string,
    accessToken: string,
    range: ReportRangeDto,
  ) {
    return this.rpc(accessToken, 'cash_flow_report', {
      p_workspace_id: workspaceId,
      ...(range.from ? { p_from: range.from } : {}),
      ...(range.to ? { p_to: range.to } : {}),
      p_granularity: range.granularity ?? 'month',
    });
  }

  getNetWorthReport(
    workspaceId: string,
    accessToken: string,
    range: ReportRangeDto,
  ) {
    return this.rpc(accessToken, 'net_worth_report', {
      p_workspace_id: workspaceId,
      ...(range.from ? { p_from: range.from } : {}),
      ...(range.to ? { p_to: range.to } : {}),
      p_granularity: range.granularity ?? 'month',
    });
  }
}
