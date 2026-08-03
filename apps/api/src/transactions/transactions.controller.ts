/**
 * Transactions Controller — Blueprint §11.2
 *
 * POST   /v1/workspaces/:workspaceId/transactions  — create
 * GET    /v1/workspaces/:workspaceId/transactions  — list (cursor paginated)
 * GET    /v1/transactions/:id                      — detail with postings
 * POST   /v1/transactions/:id/reverse              — reversal
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { TransactionsService } from './transactions.service';
import {
  CreateTransactionDto,
  TransactionResponseDto,
} from './dto/transaction.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { WorkspaceMemberGuard } from '../auth/guards/workspace-member.guard';

@ApiTags('Transactions')
@ApiBearerAuth('supabase-auth')
@Controller()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('workspaces/:workspaceId/transactions')
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: 'Create a new transaction (income/expense/transfer)' })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  @ApiCreatedResponse({ type: TransactionResponseDto })
  async create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { accessToken: string },
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionsService.createTransaction(
      workspaceId,
      user.id,
      req.accessToken,
      dto,
    );
  }

  @Get('workspaces/:workspaceId/transactions')
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: 'List transactions with cursor pagination' })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  @ApiOkResponse({ type: TransactionResponseDto })
  async list(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request & { accessToken: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transactionsService.listTransactions(
      workspaceId,
      req.accessToken,
      cursor,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get transaction detail with postings' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ type: TransactionResponseDto })
  async getOne(
    @Param('id') transactionId: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.transactionsService.getTransaction(
      transactionId,
      req.accessToken,
    );
  }

  @Post('transactions/:id/reverse')
  @ApiOperation({ summary: 'Reverse a posted transaction' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiCreatedResponse({ type: TransactionResponseDto })
  async reverse(
    @Param('id') transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.transactionsService.reverseTransaction(
      transactionId,
      user.id,
      req.accessToken,
    );
  }
}
