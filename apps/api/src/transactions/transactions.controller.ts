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
  Delete,
  Get,
  Patch,
  Post,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
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
  CreateAttachmentDto,
  TagNameDto,
  UpdateTransactionTagsDto,
  TransactionPageResponseDto,
  TransactionAttachmentResponseDto,
  TagResponseDto,
  SignedAttachmentUrlResponseDto,
  DeletedAttachmentResponseDto,
  DeletedTagResponseDto,
} from './dto/transaction.dto';
import { AttachmentsService } from './attachments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ThrottleLedgerWrite } from '../common/throttle';
import { WorkspaceMemberGuard } from '../auth/guards/workspace-member.guard';

@ApiTags('Transactions')
@ApiBearerAuth('supabase-auth')
@Controller()
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Post('workspaces/:workspaceId/transactions')
  @ThrottleLedgerWrite()
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({
    summary: 'Create a new transaction (income/expense/transfer)',
  })
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
  @ApiQuery({
    name: 'tag',
    required: false,
    description: 'Only entries carrying this tag. Intersects with `category`.',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description:
      'Drill-down filter (§5.3) — only entries posting against this category. ' +
      'This is what turns a budget line or a report slice into the transactions behind it.',
  })
  @ApiOkResponse({ type: TransactionPageResponseDto })
  async list(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request & { accessToken: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('tag') tag?: string,
  ) {
    // Shape-checked before it reaches the service: a non-UUID would go to
    // Postgres as a uuid literal and come back as a 500 for a bad link.
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;

    return this.transactionsService.listTransactions(
      workspaceId,
      req.accessToken,
      cursor,
      Number.isFinite(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), 200)
        : 20,
      category && uuid.test(category) ? category : undefined,
      tag && uuid.test(tag) ? tag : undefined,
    );
  }

  // ── Tags (§6.3) ─────────────────────────────────────────────────────────
  // Declared BEFORE `transactions/:id` would matter if it shared a prefix; it
  // does not, but the ordering is kept deliberate because Nest matches routes
  // in declaration order and `/tags` under a `:id` segment is a classic way to
  // make a working endpoint unreachable.
  @Get('workspaces/:workspaceId/tags')
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({
    summary: 'Every tag in the workspace, with usage counts',
    description:
      'The count distinguishes a label in active use from one left behind by a ' +
      'typo — which is the decision this list exists to support.',
  })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  @ApiOkResponse({ type: [TagResponseDto] })
  async listTags(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.transactionsService.listTags(workspaceId, req.accessToken);
  }

  @Post('workspaces/:workspaceId/tags')
  @ThrottleLedgerWrite()
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: 'Create a workspace tag' })
  @ApiCreatedResponse({ type: TagResponseDto })
  async createTag(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request & { accessToken: string },
    @Body() dto: TagNameDto,
  ) {
    return this.transactionsService.createTag(
      workspaceId,
      req.accessToken,
      dto.name,
    );
  }

  @Patch('workspaces/:workspaceId/tags/:tagId')
  @ThrottleLedgerWrite()
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: 'Rename a workspace tag everywhere it is used' })
  @ApiOkResponse({ type: TagResponseDto })
  async renameTag(
    @Param('workspaceId') workspaceId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
    @Req() req: Request & { accessToken: string },
    @Body() dto: TagNameDto,
  ) {
    return this.transactionsService.renameTag(
      tagId,
      workspaceId,
      req.accessToken,
      dto.name,
    );
  }

  @Delete('workspaces/:workspaceId/tags/:tagId')
  @ThrottleLedgerWrite()
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({
    summary: 'Delete a tag',
    description:
      'Detaches it from every entry and alters no posting — a tag is a label, ' +
      'not a fact about the money.',
  })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  @ApiParam({ name: 'tagId', type: 'string' })
  @ApiOkResponse({ type: DeletedTagResponseDto })
  async deleteTag(
    @Param('workspaceId') workspaceId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.transactionsService.deleteTag(
      tagId,
      workspaceId,
      req.accessToken,
    );
  }

  @Get('workspaces/:workspaceId/transactions/:id')
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: 'Get transaction detail with postings' })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ type: TransactionResponseDto })
  async getOne(
    @Param('workspaceId') workspaceId: string,
    @Param('id') transactionId: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.transactionsService.getTransaction(
      transactionId,
      workspaceId,
      req.accessToken,
    );
  }

  @Put('workspaces/:workspaceId/transactions/:id/tags')
  @ThrottleLedgerWrite()
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: 'Replace every tag on a transaction' })
  @ApiOkResponse({ type: TransactionResponseDto })
  async replaceTransactionTags(
    @Param('workspaceId') workspaceId: string,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Req() req: Request & { accessToken: string },
    @Body() dto: UpdateTransactionTagsDto,
  ) {
    await this.transactionsService.replaceTransactionTags(
      transactionId,
      workspaceId,
      req.accessToken,
      dto.tags,
    );
    return this.transactionsService.getTransaction(
      transactionId,
      workspaceId,
      req.accessToken,
    );
  }

  @Post('workspaces/:workspaceId/transactions/:id/attachments')
  @ThrottleLedgerWrite()
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({
    summary: 'Upload a private receipt image or PDF (maximum 5 MB)',
  })
  @ApiCreatedResponse({ type: TransactionAttachmentResponseDto })
  attach(
    @Param('workspaceId') workspaceId: string,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { accessToken: string },
    @Body() dto: CreateAttachmentDto,
  ) {
    return this.attachments.create(
      workspaceId,
      transactionId,
      user.id,
      req.accessToken,
      dto,
    );
  }

  @Get('workspaces/:workspaceId/transactions/:id/attachments/:attachmentId')
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: 'Create a one-minute signed receipt download URL' })
  @ApiOkResponse({ type: SignedAttachmentUrlResponseDto })
  attachmentUrl(
    @Param('workspaceId') workspaceId: string,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.attachments.signedUrl(
      workspaceId,
      transactionId,
      attachmentId,
      req.accessToken,
    );
  }

  @Delete('workspaces/:workspaceId/transactions/:id/attachments/:attachmentId')
  @ThrottleLedgerWrite()
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: 'Permanently delete a receipt owned by the caller' })
  @ApiOkResponse({ type: DeletedAttachmentResponseDto })
  deleteAttachment(
    @Param('workspaceId') workspaceId: string,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.attachments.remove(
      workspaceId,
      transactionId,
      attachmentId,
      user.id,
      req.accessToken,
    );
  }

  // Reversal MUTATES the ledger and previously ran with no workspace guard at
  // all — the most exposed of the three unguarded routes (DEC-005).
  @Post('workspaces/:workspaceId/transactions/:id/reverse')
  @ThrottleLedgerWrite()
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: 'Reverse a posted transaction' })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiCreatedResponse({ type: TransactionResponseDto })
  async reverse(
    @Param('workspaceId') workspaceId: string,
    @Param('id') transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.transactionsService.reverseTransaction(
      transactionId,
      workspaceId,
      user.id,
      req.accessToken,
    );
  }
}
