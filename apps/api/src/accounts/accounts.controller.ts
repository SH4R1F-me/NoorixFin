/**
 * Accounts Controller — Blueprint §11.2
 *
 * POST   /v1/workspaces/:workspaceId/accounts  — create
 * GET    /v1/workspaces/:workspaceId/accounts  — list with balances
 * PATCH  /v1/accounts/:id                      — update/archive
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
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
} from '@nestjs/swagger';
import { Request } from 'express';
import { AccountsService } from './accounts.service';
import {
  CreateAccountDto,
  UpdateAccountDto,
  AccountResponseDto,
} from './dto/account.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { WorkspaceMemberGuard } from '../auth/guards/workspace-member.guard';

@ApiTags('Accounts')
@ApiBearerAuth('supabase-auth')
@Controller()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('workspaces/:workspaceId/accounts')
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: 'Create a new ledger account' })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  @ApiCreatedResponse({ type: AccountResponseDto })
  async create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { accessToken: string },
    @Body() dto: CreateAccountDto,
  ) {
    return this.accountsService.createAccount(
      workspaceId,
      user.id,
      req.accessToken,
      dto,
    );
  }

  @Get('workspaces/:workspaceId/accounts')
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: 'List workspace accounts with balances' })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  @ApiOkResponse({ type: [AccountResponseDto] })
  async list(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.accountsService.listAccounts(workspaceId, req.accessToken);
  }

  @Patch('accounts/:id')
  @ApiOperation({ summary: 'Update an account (name, flags, archive)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ type: AccountResponseDto })
  async update(
    @Param('id') accountId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { accessToken: string },
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.updateAccount(
      accountId,
      user.id,
      req.accessToken,
      dto,
    );
  }
}
