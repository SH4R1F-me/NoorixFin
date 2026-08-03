/**
 * Transactions Service — Blueprint §8.2, §8.3
 *
 * Creates balanced journal entries from simple user input.
 * Enforces: balanced postings, idempotency, no floating-point.
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTransactionDto } from './dto/transaction.dto';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Create a transaction as a balanced journal entry.
   * Blueprint §8.2: User sees simple form; backend creates balanced journal.
   */
  async createTransaction(
    workspaceId: string,
    userId: string,
    accessToken: string,
    dto: CreateTransactionDto,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);
    const amount = parseInt(dto.amount, 10);

    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Amount must be a positive integer in minor units',
      });
    }

    // Idempotency check (§8.3)
    const idempotencyHash = createHash('sha256')
      .update(`${userId}:transactions:${dto.idempotency_key}`)
      .digest('hex');

    const { data: existingEntry } = await client
      .from('journal_entries')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('created_by', userId)
      .eq('client_entry_id', dto.idempotency_key)
      .single();

    if (existingEntry) {
      // Return existing result (§8.3: same key → previous result)
      const { data: postings } = await client
        .from('journal_postings')
        .select('*')
        .eq('journal_entry_id', existingEntry.id);

      return { ...existingEntry, postings: postings || [] };
    }

    // Determine entry type mapping
    const entryType = dto.type;
    const occurredAt = dto.occurred_at || new Date().toISOString();
    const localDate = occurredAt.split('T')[0];

    const entryId = uuidv4();

    // Create journal entry
    const { data: entry, error: entryError } = await client
      .from('journal_entries')
      .insert({
        id: entryId,
        workspace_id: workspaceId,
        entry_type: entryType,
        occurred_at: occurredAt,
        local_date: localDate,
        payee: dto.payee || null,
        note: dto.note || null,
        status: 'POSTED',
        source: 'MANUAL',
        client_entry_id: dto.idempotency_key,
        created_by: userId,
        posted_at: new Date().toISOString(),
        version: 1,
      })
      .select()
      .single();

    if (entryError) {
      this.logger.error(`Failed to create journal entry: ${entryError.message}`);
      throw new BadRequestException('Failed to create transaction');
    }

    // Get account info for currency
    const { data: account } = await client
      .from('ledger_accounts')
      .select('currency_code')
      .eq('id', dto.account_id)
      .single();

    const currencyCode = account?.currency_code || 'BDT';

    // Create balanced postings based on transaction type (§8.2)
    const postings = this.buildPostings(
      entryId,
      dto.type,
      amount,
      dto.account_id,
      dto.category_id,
      dto.transfer_to_account_id,
      currencyCode,
    );

    const { data: createdPostings, error: postingError } = await client
      .from('journal_postings')
      .insert(postings)
      .select();

    if (postingError) {
      this.logger.error(`Failed to create postings: ${postingError.message}`);
      // Clean up the entry
      await client.from('journal_entries').delete().eq('id', entryId);
      throw new BadRequestException('Failed to create transaction postings');
    }

    // Handle tags
    if (dto.tags && dto.tags.length > 0) {
      for (const tagName of dto.tags) {
        // Get or create tag
        let { data: tag } = await client
          .from('tags')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('name', tagName)
          .single();

        if (!tag) {
          const { data: newTag } = await client
            .from('tags')
            .insert({
              id: uuidv4(),
              workspace_id: workspaceId,
              name: tagName,
            })
            .select()
            .single();
          tag = newTag;
        }

        if (tag) {
          await client.from('journal_entry_tags').insert({
            journal_entry_id: entryId,
            tag_id: tag.id,
          });
        }
      }
    }

    return { ...entry, postings: createdPostings || [] };
  }

  /**
   * List transactions with cursor pagination.
   * Blueprint §11.1: cursor pagination, not offset.
   */
  async listTransactions(
    workspaceId: string,
    accessToken: string,
    cursor?: string,
    limit = 20,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);

    let query = client
      .from('journal_entries')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1); // Fetch one extra for next cursor

    if (cursor) {
      // Cursor is the occurred_at of the last item
      query = query.lt('occurred_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to list transactions: ${error.message}`);
      throw new BadRequestException('Failed to list transactions');
    }

    const entries = data || [];
    const hasMore = entries.length > limit;
    const items = hasMore ? entries.slice(0, limit) : entries;
    const nextCursor = hasMore
      ? items[items.length - 1]?.occurred_at
      : undefined;

    return {
      items,
      next_cursor: nextCursor,
      has_more: hasMore,
    };
  }

  /**
   * Get a single transaction with its postings.
   */
  async getTransaction(transactionId: string, accessToken: string) {
    const client = this.supabaseService.getUserClient(accessToken);

    const { data: entry, error } = await client
      .from('journal_entries')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error || !entry) {
      throw new NotFoundException({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Transaction not found',
      });
    }

    const { data: postings } = await client
      .from('journal_postings')
      .select('*')
      .eq('journal_entry_id', transactionId);

    return { ...entry, postings: postings || [] };
  }

  /**
   * Reverse a transaction (§8.2: correction creates reversal entry).
   * Never modifies the original — creates a new REVERSAL entry.
   */
  async reverseTransaction(
    transactionId: string,
    userId: string,
    accessToken: string,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);

    // Get original entry
    const { data: original, error } = await client
      .from('journal_entries')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error || !original) {
      throw new NotFoundException({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Transaction not found',
      });
    }

    if (original.status !== 'POSTED') {
      throw new BadRequestException({
        code: 'CANNOT_REVERSE',
        message: 'Only POSTED transactions can be reversed',
      });
    }

    // Get original postings
    const { data: originalPostings } = await client
      .from('journal_postings')
      .select('*')
      .eq('journal_entry_id', transactionId);

    if (!originalPostings || originalPostings.length === 0) {
      throw new BadRequestException({
        code: 'NO_POSTINGS',
        message: 'Original transaction has no postings',
      });
    }

    const reversalId = uuidv4();

    // Create reversal entry
    const { data: reversalEntry, error: reversalError } = await client
      .from('journal_entries')
      .insert({
        id: reversalId,
        workspace_id: original.workspace_id,
        entry_type: 'REVERSAL',
        occurred_at: new Date().toISOString(),
        local_date: new Date().toISOString().split('T')[0],
        note: `Reversal of ${original.id}`,
        status: 'POSTED',
        source: 'MANUAL',
        client_entry_id: uuidv4(),
        reverses_entry_id: transactionId,
        created_by: userId,
        posted_at: new Date().toISOString(),
        version: 1,
      })
      .select()
      .single();

    if (reversalError) {
      throw new BadRequestException('Failed to create reversal');
    }

    // Create reversed postings (swap debit/credit)
    const reversedPostings = originalPostings.map((p) => ({
      id: uuidv4(),
      journal_entry_id: reversalId,
      ledger_account_id: p.ledger_account_id,
      debit_minor: p.credit_minor,
      credit_minor: p.debit_minor,
      currency_code: p.currency_code,
      base_amount_minor: p.base_amount_minor,
      memo: `Reversal of posting ${p.id}`,
    }));

    await client.from('journal_postings').insert(reversedPostings);

    // Void the original
    await client
      .from('journal_entries')
      .update({ status: 'VOIDED', updated_at: new Date().toISOString() })
      .eq('id', transactionId);

    return { ...reversalEntry, postings: reversedPostings };
  }

  /**
   * Build balanced postings based on transaction type.
   * Blueprint §8.2:
   * - Expense: Asset credit + Expense category debit
   * - Income: Income category credit + Asset debit
   * - Transfer: Source credit + Destination debit
   */
  private buildPostings(
    entryId: string,
    type: string,
    amount: number,
    accountId: string,
    categoryId?: string,
    transferToId?: string,
    currencyCode = 'BDT',
  ) {
    const postings = [];

    switch (type) {
      case 'EXPENSE':
        if (!categoryId) {
          throw new BadRequestException({
            code: 'CATEGORY_REQUIRED',
            message: 'Category is required for expense transactions',
          });
        }
        // Asset account credit (money goes out)
        postings.push({
          id: uuidv4(),
          journal_entry_id: entryId,
          ledger_account_id: accountId,
          debit_minor: 0,
          credit_minor: amount,
          currency_code: currencyCode,
          base_amount_minor: amount,
        });
        // Expense category debit (expense increases)
        postings.push({
          id: uuidv4(),
          journal_entry_id: entryId,
          ledger_account_id: categoryId,
          debit_minor: amount,
          credit_minor: 0,
          currency_code: currencyCode,
          base_amount_minor: amount,
        });
        break;

      case 'INCOME':
        if (!categoryId) {
          throw new BadRequestException({
            code: 'CATEGORY_REQUIRED',
            message: 'Category is required for income transactions',
          });
        }
        // Asset account debit (money comes in)
        postings.push({
          id: uuidv4(),
          journal_entry_id: entryId,
          ledger_account_id: accountId,
          debit_minor: amount,
          credit_minor: 0,
          currency_code: currencyCode,
          base_amount_minor: amount,
        });
        // Income category credit (income increases)
        postings.push({
          id: uuidv4(),
          journal_entry_id: entryId,
          ledger_account_id: categoryId,
          debit_minor: 0,
          credit_minor: amount,
          currency_code: currencyCode,
          base_amount_minor: amount,
        });
        break;

      case 'TRANSFER':
        if (!transferToId) {
          throw new BadRequestException({
            code: 'DESTINATION_REQUIRED',
            message: 'Destination account is required for transfers',
          });
        }
        // Source account credit (money leaves)
        postings.push({
          id: uuidv4(),
          journal_entry_id: entryId,
          ledger_account_id: accountId,
          debit_minor: 0,
          credit_minor: amount,
          currency_code: currencyCode,
          base_amount_minor: amount,
        });
        // Destination account debit (money arrives)
        postings.push({
          id: uuidv4(),
          journal_entry_id: entryId,
          ledger_account_id: transferToId,
          debit_minor: amount,
          credit_minor: 0,
          currency_code: currencyCode,
          base_amount_minor: amount,
        });
        break;

      default:
        throw new BadRequestException({
          code: 'INVALID_TYPE',
          message: 'Invalid transaction type',
        });
    }

    return postings;
  }
}
