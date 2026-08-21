/**
 * Planning DTOs — Blueprint §9.4.
 *
 * ── WHY EVERY AMOUNT IS A STRING ─────────────────────────────────────────────
 * DEC-004 keeps money in minor units and out of floating point. A JSON `number`
 * is an IEEE-754 double, so a client that sends 999999999999999 gets a silently
 * different value back, and `class-transformer` would happily coerce "12.5"
 * into a fractional "minor unit" that means nothing. Amounts therefore arrive
 * as digit strings and are parsed to BigInt-safe integers in the service, which
 * matches how transactions already work (§8.1).
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** A non-negative integer in minor units, as digits only. */
const MINOR_UNITS = /^\d{1,18}$/;

export class BudgetLineResponseDto {
  @ApiProperty() line_id!: string;
  @ApiProperty() category_id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) translation_key!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) custom_name!: string | null;
  @ApiProperty() icon!: string;
  @ApiProperty() color!: string;
  @ApiProperty() planned_minor!: number;
  @ApiProperty() spent_minor!: number;
  @ApiProperty() remaining_minor!: number;
  @ApiProperty() alert_threshold_pct!: number;
}

export class BudgetStatusResponseDto {
  @ApiProperty() visible!: boolean;
  @ApiPropertyOptional() has_budget?: boolean;
  @ApiPropertyOptional() budget_id?: string;
  @ApiPropertyOptional() name?: string;
  @ApiPropertyOptional({ enum: ['MONTHLY', 'WEEKLY'] }) cadence?: string;
  @ApiPropertyOptional() rollover?: boolean;
  @ApiPropertyOptional() period_start?: string;
  @ApiPropertyOptional() period_end?: string;
  @ApiPropertyOptional() planned_total?: number;
  @ApiPropertyOptional() spent_total?: number;
  @ApiPropertyOptional({ type: [BudgetLineResponseDto] })
  lines?: BudgetLineResponseDto[];
  @ApiPropertyOptional() timezone?: string;
  @ApiPropertyOptional() generated_at?: string;
}

export class GoalProgressResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() target_minor!: number;
  @ApiProperty({ type: Number, nullable: true }) current_minor!: number | null;
  @ApiProperty() currency_code!: string;
  @ApiProperty({ type: String, nullable: true }) target_date!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() priority!: number;
  @ApiProperty({ type: String, nullable: true }) linked_account_id!:
    string | null;
  @ApiProperty({ type: Number, nullable: true }) days_left!: number | null;
}

export class GoalsOverviewResponseDto {
  @ApiProperty() visible!: boolean;
  @ApiPropertyOptional({ type: [GoalProgressResponseDto] })
  goals?: GoalProgressResponseDto[];
  @ApiPropertyOptional({ type: () => [DebtResponseDto] })
  debts?: DebtResponseDto[];
  @ApiPropertyOptional() total_debt_minor?: number;
  @ApiPropertyOptional() timezone?: string;
  @ApiPropertyOptional() generated_at?: string;
}

export class DeletedResponseDto {
  @ApiProperty() deleted!: boolean;
}

export class DebtResponseDto {
  @ApiProperty() ledger_account_id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() currency_code!: string;
  @ApiProperty() principal_minor!: number;
  @ApiProperty() outstanding_minor!: number;
  @ApiProperty({ type: Number, nullable: true }) annual_rate_bps!:
    number | null;
  @ApiProperty({ type: Number, nullable: true }) minimum_payment_minor!:
    number | null;
  @ApiProperty({ type: Number, nullable: true }) due_day!: number | null;
}

export class DebtOverviewResponseDto {
  @ApiProperty({ type: [DebtResponseDto] }) debts!: DebtResponseDto[];
  @ApiProperty() total_debt_minor!: number;
}

export class CalendarEventResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workspace_id!: string;
  @ApiProperty({ enum: ['BILL', 'INCOME', 'GOAL', 'CUSTOM'] }) type!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: Number, nullable: true }) amount_minor!: number | null;
  @ApiProperty() currency_code!: string;
  @ApiProperty() due_at!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty() local_date!: string;
  @ApiProperty({ type: [Number] }) reminder_offsets!: number[];
  @ApiProperty({ enum: ['UPCOMING', 'DUE', 'OVERDUE', 'PAID', 'SKIPPED'] })
  status!: string;
  @ApiProperty({ type: String, nullable: true }) journal_entry_id!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) recurring_rule_id!:
    string | null;
  @ApiPropertyOptional() days_away?: number;
}

export class CalendarOverviewResponseDto {
  @ApiProperty() visible!: boolean;
  @ApiProperty() timezone!: string;
  @ApiProperty() today!: string;
  @ApiProperty() horizon_days!: number;
  @ApiProperty() generated_at!: string;
  @ApiProperty({ type: [CalendarEventResponseDto] })
  events!: CalendarEventResponseDto[];
  @ApiProperty() overdue_count!: number;
  @ApiProperty() due_soon_total_minor!: number;
}

export class RecurringRuleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workspace_id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['EXPENSE', 'INCOME'] }) entry_type!: string;
  @ApiProperty() amount_minor!: number;
  @ApiProperty() currency_code!: string;
  @ApiProperty({ type: String, nullable: true }) account_id!: string | null;
  @ApiProperty({ type: String, nullable: true }) category_id!: string | null;
  @ApiProperty({ type: String, nullable: true }) payee!: string | null;
  @ApiProperty({ enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] })
  frequency!: string;
  @ApiProperty() interval_count!: number;
  @ApiProperty() timezone!: string;
  @ApiProperty() next_occurrence!: string;
  @ApiProperty({ type: String, nullable: true }) ends_at!: string | null;
  @ApiProperty({ enum: ['REMIND_ONLY', 'AUTO_CREATE_DRAFT'] })
  behavior!: string;
  @ApiProperty({ enum: ['ACTIVE', 'PAUSED', 'ENDED'] }) status!: string;
  @ApiProperty() created_at!: string;
}

export class CategoryReportLineResponseDto {
  @ApiProperty() category_id!: string;
  @ApiProperty({ type: String, nullable: true }) custom_name!: string | null;
  @ApiProperty({ type: String, nullable: true }) translation_key!:
    string | null;
  @ApiProperty() icon!: string;
  @ApiProperty() color!: string;
  @ApiProperty({ enum: ['INCOME', 'EXPENSE'] }) kind!: string;
  @ApiProperty() amount_minor!: number;
  @ApiProperty() entry_count!: number;
}

export class CategoryTrendResponseDto {
  @ApiProperty() month!: string;
  @ApiProperty() income_minor!: number;
  @ApiProperty() expense_minor!: number;
}

export class CategoryReportResponseDto {
  @ApiProperty() visible!: boolean;
  @ApiProperty() period_from!: string;
  @ApiProperty() period_to!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty() currency_basis!: string;
  @ApiProperty() generated_at!: string;
  @ApiProperty({ type: [CategoryReportLineResponseDto] })
  categories!: CategoryReportLineResponseDto[];
  @ApiProperty({ type: [CategoryTrendResponseDto] })
  trend!: CategoryTrendResponseDto[];
}

export class CashFlowPeriodResponseDto {
  @ApiProperty() period_start!: string;
  @ApiProperty() period_end!: string;
  @ApiProperty() income_minor!: number;
  @ApiProperty() expense_minor!: number;
  @ApiProperty() net_minor!: number;
}
export class NetWorthPeriodResponseDto {
  @ApiProperty() period_start!: string;
  @ApiProperty() period_end!: string;
  @ApiProperty() assets_minor!: number;
  @ApiProperty() liabilities_minor!: number;
  @ApiProperty() net_worth_minor!: number;
}
export class CashFlowReportResponseDto {
  @ApiProperty() visible!: boolean;
  @ApiPropertyOptional() period_from?: string;
  @ApiPropertyOptional() period_to?: string;
  @ApiPropertyOptional({ enum: ['day', 'week', 'month'] }) granularity?: string;
  @ApiPropertyOptional() timezone?: string;
  @ApiPropertyOptional() currency_basis?: string;
  @ApiPropertyOptional() generated_at?: string;
  @ApiPropertyOptional({ type: [CashFlowPeriodResponseDto] })
  periods?: CashFlowPeriodResponseDto[];
}
export class NetWorthReportResponseDto {
  @ApiProperty() visible!: boolean;
  @ApiPropertyOptional() period_from?: string;
  @ApiPropertyOptional() period_to?: string;
  @ApiPropertyOptional({ enum: ['day', 'week', 'month'] }) granularity?: string;
  @ApiPropertyOptional() timezone?: string;
  @ApiPropertyOptional() currency_basis?: string;
  @ApiPropertyOptional() generated_at?: string;
  @ApiPropertyOptional({ type: [NetWorthPeriodResponseDto] })
  periods?: NetWorthPeriodResponseDto[];
}

// ─── Budgets ─────────────────────────────────────────────────────────────────

export class BudgetLineInputDto {
  @ApiProperty({ description: 'Category this limit applies to' })
  @IsUUID()
  category_id!: string;

  @ApiProperty({
    example: '2000000',
    description: 'Planned limit, minor units',
  })
  @Matches(MINOR_UNITS, {
    message: 'planned_minor must be a whole number of minor units',
  })
  planned_minor!: string;

  @ApiPropertyOptional({
    example: 80,
    description: 'Warn at this % of the limit. 0 disables.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  alert_threshold_pct?: number;
}

export class UpsertBudgetDto {
  @ApiPropertyOptional({ example: 'Monthly budget' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  name?: string;

  @ApiPropertyOptional({ enum: ['MONTHLY', 'WEEKLY'] })
  @IsOptional()
  @IsIn(['MONTHLY', 'WEEKLY'])
  cadence?: 'MONTHLY' | 'WEEKLY';

  @ApiPropertyOptional({
    description: 'Whether unspent limit carries into the next period',
  })
  @IsOptional()
  @IsBoolean()
  rollover?: boolean;

  /**
   * The full set of lines. Sent whole rather than patched one at a time
   * because the screen edits them together, and a partial apply would leave a
   * budget whose lines came from two different intentions.
   */
  @ApiProperty({ type: [BudgetLineInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetLineInputDto)
  lines!: BudgetLineInputDto[];
}

// ─── Savings goals ───────────────────────────────────────────────────────────

export class CreateGoalDto {
  @ApiProperty({ example: 'Emergency fund' })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({ example: '10000000', description: 'Target, minor units' })
  @Matches(MINOR_UNITS)
  target_minor!: string;

  @ApiPropertyOptional({ example: 'BDT' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency_code?: string;

  @ApiPropertyOptional({ example: '2027-01-01' })
  @IsOptional()
  @IsISO8601()
  target_date?: string;

  /**
   * Optional, and its absence is meaningful: §9.4 requires progress to be
   * source-driven, so a goal with no linked account reports `null` progress
   * rather than 0. "Link an account" and "you have saved nothing" are different
   * statements and the UI must be able to tell them apart.
   */
  @ApiPropertyOptional({ description: 'Account whose balance IS the progress' })
  @IsOptional()
  @IsUUID()
  linked_account_id?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;
}

export class UpdateGoalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(MINOR_UNITS)
  target_minor?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() target_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() linked_account_id?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'ACHIEVED', 'ABANDONED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'ACHIEVED', 'ABANDONED'])
  status?: string;
}

// ─── Debt terms ──────────────────────────────────────────────────────────────

export class UpsertDebtDto {
  @ApiProperty({
    description: 'The LIABILITY ledger account these terms describe',
  })
  @IsUUID()
  ledger_account_id!: string;

  @ApiProperty({
    example: '30000000',
    description: 'Original principal, minor units',
  })
  @Matches(MINOR_UNITS)
  principal_minor!: string;

  /**
   * Basis points, not a percentage float: a rate that is compounded must not be
   * a double for the same reason an amount must not be (DEC-004). 950 = 9.50%.
   * Optional because informal loans often have no stated rate, and defaulting
   * to 0 would render "0% APR", which is a claim rather than a blank.
   */
  @ApiPropertyOptional({
    example: 950,
    description: 'Annual rate in basis points',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  annual_rate_bps?: number;

  @ApiPropertyOptional({ example: '150000' })
  @IsOptional()
  @Matches(MINOR_UNITS)
  minimum_payment_minor?: string;

  @ApiPropertyOptional({
    example: 5,
    description: 'Day of month the payment is due',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  due_day?: number;
}

// ─── Calendar events ─────────────────────────────────────────────────────────

export class CreateCalendarEventDto {
  @ApiProperty({ enum: ['BILL', 'INCOME', 'GOAL', 'CUSTOM'] })
  @IsIn(['BILL', 'INCOME', 'GOAL', 'CUSTOM'])
  type!: 'BILL' | 'INCOME' | 'GOAL' | 'CUSTOM';

  @ApiProperty({ example: 'Electricity bill' })
  @IsString()
  @Length(1, 120)
  title!: string;

  @ApiPropertyOptional({ example: '120000' })
  @IsOptional()
  @Matches(MINOR_UNITS)
  amount_minor?: string;

  @ApiPropertyOptional({ example: 'BDT' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency_code?: string;

  @ApiProperty({
    example: '2026-08-10',
    description: 'Due date in the workspace timezone',
  })
  @IsISO8601()
  due_date!: string;

  @ApiPropertyOptional({
    type: [Number],
    example: [1440, 60],
    description: 'Remind this many minutes before the due time',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  reminder_offsets?: number[];
}

export class UpdateCalendarEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  title?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(MINOR_UNITS)
  amount_minor?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() due_date?: string;

  /**
   * OVERDUE is absent on purpose. It is derived by `calendar_overview()` from
   * `status='UPCOMING' AND due < today`, so it can never be stale. Letting a
   * client write it would create a second, staler answer to the same question.
   */
  @ApiPropertyOptional({ enum: ['UPCOMING', 'PAID', 'SKIPPED'] })
  @IsOptional()
  @IsIn(['UPCOMING', 'PAID', 'SKIPPED'])
  status?: 'UPCOMING' | 'PAID' | 'SKIPPED';

  @ApiPropertyOptional({
    description: 'The transaction that settled this event',
  })
  @IsOptional()
  @IsUUID()
  journal_entry_id?: string;
}

// ─── Recurring rules ─────────────────────────────────────────────────────────

export class CreateRecurringRuleDto {
  @ApiProperty({ example: 'Rent' })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({ enum: ['INCOME', 'EXPENSE', 'TRANSFER'] })
  @IsIn(['INCOME', 'EXPENSE', 'TRANSFER'])
  entry_type!: 'INCOME' | 'EXPENSE' | 'TRANSFER';

  @ApiProperty({ example: '1500000' })
  @Matches(MINOR_UNITS)
  amount_minor!: string;

  @ApiPropertyOptional({ example: 'BDT' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency_code?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() account_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() category_id?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  payee?: string;

  @ApiProperty({ enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] })
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])
  frequency!: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  interval_count?: number;

  @ApiProperty({ example: '2026-09-01' })
  @IsISO8601()
  next_occurrence!: string;

  @ApiPropertyOptional({ example: '2027-09-01' })
  @IsOptional()
  @IsISO8601()
  ends_at?: string;

  /**
   * `AUTO_CREATE_DRAFT` is the strongest behaviour available, and it still only
   * produces a DRAFT. §9.4: "MVP-তে unconfirmed external expense auto-post নয়" —
   * nothing in this system posts an entry the user has not confirmed.
   */
  @ApiPropertyOptional({ enum: ['REMIND_ONLY', 'AUTO_CREATE_DRAFT'] })
  @IsOptional()
  @IsIn(['REMIND_ONLY', 'AUTO_CREATE_DRAFT'])
  behavior?: 'REMIND_ONLY' | 'AUTO_CREATE_DRAFT';
}

export class UpdateRecurringRuleDto {
  @ApiProperty({
    enum: ['ACTIVE', 'PAUSED'],
    description:
      'Pause or resume future processing without deleting the template',
  })
  @IsIn(['ACTIVE', 'PAUSED'])
  status!: 'ACTIVE' | 'PAUSED';
}

export class ReportRangeDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Inclusive local date',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({
    example: '2026-08-14',
    description: 'Exclusive local date',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'month' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  granularity?: 'day' | 'week' | 'month';
}
