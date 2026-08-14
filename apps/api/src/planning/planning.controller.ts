/**
 * Planning Controller — Blueprint §11.2, §11.3.
 *
 * Every route is workspace-scoped and behind `WorkspaceMemberGuard`. That is
 * deliberate belt-and-braces: RLS would already deny a cross-workspace row, but
 * DEC-005 makes NestJS the PRIMARY authorization layer with RLS as
 * defence-in-depth. A route relying on RLS alone is one migration away from
 * being the only thing standing between two tenants.
 *
 * `:id` routes carry `:workspaceId` in the path for the same reason — the guard
 * reads it, so an id belonging to someone else is refused before the query runs
 * rather than quietly returning zero rows.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { PlanningService } from './planning.service';
import {
  CreateCalendarEventDto,
  CreateGoalDto,
  CreateRecurringRuleDto,
  UpdateRecurringRuleDto,
  UpdateCalendarEventDto,
  UpdateGoalDto,
  UpsertBudgetDto,
  UpsertDebtDto,
  ReportRangeDto,
  BudgetStatusResponseDto,
  GoalsOverviewResponseDto,
} from './dto/planning.dto';
import { ThrottleLedgerWrite, ThrottleReport } from '../common/throttle';
import { WorkspaceMemberGuard } from '../auth/guards/workspace-member.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

type AuthedRequest = Request & { accessToken: string };

function validateReportRange(query: ReportRangeDto): ReportRangeDto {
  if (!query.from || !query.to) return query;
  const from = new Date(`${query.from}T00:00:00Z`);
  const to = new Date(`${query.to}T00:00:00Z`);
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days <= 0 || days > 3660) {
    throw new BadRequestException({
      code: 'INVALID_REPORT_RANGE',
      message: 'Report range must be positive and no longer than ten years',
    });
  }
  return query;
}

@ApiTags('Planning')
@ApiBearerAuth('supabase-auth')
@Controller('workspaces/:workspaceId')
@UseGuards(WorkspaceMemberGuard)
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  // ── Budgets ────────────────────────────────────────────────────────────────

  @Get('budget')
  @ApiOperation({
    summary: 'Budget status: planned vs actual for the current period',
  })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  @ApiOkResponse({
    description: 'One payload per DEC-011; spend derived from postings',
    type: BudgetStatusResponseDto,
  })
  getBudget(
    @Param('workspaceId') workspaceId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.planning.getBudgetStatus(workspaceId, req.accessToken);
  }

  // PUT, not PATCH: the body is the complete set of lines and replaces what is
  // there. A partial apply would leave a budget describing two intentions.
  @Put('budget')
  @ThrottleLedgerWrite()
  @ApiOperation({
    summary: 'Create or replace the budget and all of its lines',
  })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  upsertBudget(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthedRequest,
    @Body() dto: UpsertBudgetDto,
  ) {
    return this.planning.upsertBudget(
      workspaceId,
      user.id,
      req.accessToken,
      dto,
    );
  }

  @Delete('budget/:id')
  @ApiOperation({ summary: 'Delete a budget' })
  deleteBudget(
    @Param('workspaceId') workspaceId: string,
    @Param('id') budgetId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.planning.deleteBudget(workspaceId, req.accessToken, budgetId);
  }

  // ── Goals and debts ────────────────────────────────────────────────────────

  @Get('goals')
  @ApiOkResponse({ type: GoalsOverviewResponseDto })
  @ApiOperation({
    summary: 'Savings goals and debt summary, progress read from the ledger',
  })
  getGoals(
    @Param('workspaceId') workspaceId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.planning.getGoalsOverview(workspaceId, req.accessToken);
  }

  @Post('goals')
  @ApiOperation({ summary: 'Create a savings goal' })
  createGoal(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthedRequest,
    @Body() dto: CreateGoalDto,
  ) {
    return this.planning.createGoal(workspaceId, user.id, req.accessToken, dto);
  }

  @Patch('goals/:id')
  @ApiOperation({ summary: 'Update a savings goal (progress is not writable)' })
  updateGoal(
    @Param('workspaceId') workspaceId: string,
    @Param('id') goalId: string,
    @Req() req: AuthedRequest,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.planning.updateGoal(workspaceId, req.accessToken, goalId, dto);
  }

  @Delete('goals/:id')
  @ApiOperation({ summary: 'Delete a savings goal' })
  deleteGoal(
    @Param('workspaceId') workspaceId: string,
    @Param('id') goalId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.planning.deleteGoal(workspaceId, req.accessToken, goalId);
  }

  @Put('debts')
  @ApiOperation({
    summary: 'Attach or replace repayment terms on a liability account',
  })
  upsertDebt(
    @Param('workspaceId') workspaceId: string,
    @Req() req: AuthedRequest,
    @Body() dto: UpsertDebtDto,
  ) {
    return this.planning.upsertDebt(workspaceId, req.accessToken, dto);
  }

  @Get('debts')
  @ApiOperation({
    summary:
      'List debt terms with outstanding balances derived from the ledger',
  })
  listDebts(
    @Param('workspaceId') workspaceId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.planning.listDebts(workspaceId, req.accessToken);
  }

  @Delete('debts/:accountId')
  @ApiOperation({
    summary:
      'Remove debt terms without deleting the liability account or balance',
  })
  deleteDebt(
    @Param('workspaceId') workspaceId: string,
    @Param('accountId') accountId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.planning.deleteDebt(workspaceId, req.accessToken, accountId);
  }

  // ── Calendar ───────────────────────────────────────────────────────────────

  @Get('calendar')
  @ApiOperation({ summary: 'Upcoming, due and overdue events' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getCalendar(
    @Param('workspaceId') workspaceId: string,
    @Req() req: AuthedRequest,
    @Query('days') days?: string,
  ) {
    // Clamped rather than trusted: an unbounded horizon is an unbounded scan,
    // and `Number('abc')` is NaN, which Postgres would reject with a 500 for
    // what is really a bad request.
    const parsed = Number(days);
    const horizon = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 1), 365)
      : 30;
    return this.planning.getCalendarOverview(
      workspaceId,
      req.accessToken,
      horizon,
    );
  }

  @Post('calendar')
  @ApiOperation({ summary: 'Create a bill, expected income or reminder' })
  createEvent(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthedRequest,
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.planning.createCalendarEvent(
      workspaceId,
      user.id,
      req.accessToken,
      dto,
    );
  }

  @Patch('calendar/:id')
  @ApiOperation({ summary: 'Mark paid or skipped, or edit an event' })
  updateEvent(
    @Param('workspaceId') workspaceId: string,
    @Param('id') eventId: string,
    @Req() req: AuthedRequest,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    return this.planning.updateCalendarEvent(
      workspaceId,
      req.accessToken,
      eventId,
      dto,
    );
  }

  @Delete('calendar/:id')
  @ApiOperation({ summary: 'Delete a calendar event' })
  deleteEvent(
    @Param('workspaceId') workspaceId: string,
    @Param('id') eventId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.planning.deleteCalendarEvent(
      workspaceId,
      req.accessToken,
      eventId,
    );
  }

  // ── Recurring rules ────────────────────────────────────────────────────────

  @Get('recurring')
  @ApiOperation({ summary: 'List recurring rules' })
  listRules(
    @Param('workspaceId') workspaceId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.planning.listRecurringRules(workspaceId, req.accessToken);
  }

  @Post('recurring')
  @ApiOperation({
    summary: 'Create a recurring rule (never auto-posts — §9.4)',
  })
  createRule(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthedRequest,
    @Body() dto: CreateRecurringRuleDto,
  ) {
    return this.planning.createRecurringRule(
      workspaceId,
      user.id,
      req.accessToken,
      dto,
    );
  }

  @Patch('recurring/:id')
  @ApiOperation({ summary: 'Pause or resume a recurring rule' })
  updateRule(
    @Param('workspaceId') workspaceId: string,
    @Param('id') ruleId: string,
    @Req() req: AuthedRequest,
    @Body() dto: UpdateRecurringRuleDto,
  ) {
    return this.planning.updateRecurringRule(
      workspaceId,
      req.accessToken,
      ruleId,
      dto,
    );
  }

  @Delete('recurring/:id')
  @ApiOperation({ summary: 'Delete a recurring rule' })
  deleteRule(
    @Param('workspaceId') workspaceId: string,
    @Param('id') ruleId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.planning.deleteRecurringRule(
      workspaceId,
      req.accessToken,
      ruleId,
    );
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  @Get('reports/categories')
  @ThrottleReport()
  @ApiOperation({
    summary: 'Category breakdown and 6-month trend (§11.3 contract)',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-08-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-09-01' })
  getReport(
    @Param('workspaceId') workspaceId: string,
    @Req() req: AuthedRequest,
    @Query() query: ReportRangeDto,
  ) {
    const range = validateReportRange(query);
    return this.planning.getCategoryReport(
      workspaceId,
      req.accessToken,
      range.from,
      range.to,
    );
  }

  @Get('reports/cash-flow')
  @ThrottleReport()
  @ApiOperation({
    summary: 'Cash-flow time series for a custom local-date range',
  })
  getCashFlow(
    @Param('workspaceId') workspaceId: string,
    @Req() req: AuthedRequest,
    @Query() query: ReportRangeDto,
  ) {
    return this.planning.getCashFlowReport(
      workspaceId,
      req.accessToken,
      validateReportRange(query),
    );
  }

  @Get('reports/income-expense')
  @ThrottleReport()
  @ApiOperation({
    summary: 'Income versus expense time series for a custom range',
  })
  getIncomeExpense(
    @Param('workspaceId') workspaceId: string,
    @Req() req: AuthedRequest,
    @Query() query: ReportRangeDto,
  ) {
    return this.planning.getCashFlowReport(
      workspaceId,
      req.accessToken,
      validateReportRange(query),
    );
  }

  @Get('reports/net-worth')
  @ThrottleReport()
  @ApiOperation({ summary: 'Historical assets, liabilities and net worth' })
  getNetWorth(
    @Param('workspaceId') workspaceId: string,
    @Req() req: AuthedRequest,
    @Query() query: ReportRangeDto,
  ) {
    return this.planning.getNetWorthReport(
      workspaceId,
      req.accessToken,
      validateReportRange(query),
    );
  }
}
