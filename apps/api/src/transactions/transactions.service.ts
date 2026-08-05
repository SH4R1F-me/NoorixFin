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
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CategoriesService } from '../categories/categories.service';
import { CreateTransactionDto } from './dto/transaction.dto';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { parseMinorUnits } from '@noorixfin/money';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly categoriesService: CategoriesService,
  ) {}

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

    // Blueprint §8.1 / DEC-004: amounts arrive as minor-unit decimal strings.
    // parseMinorUnits rejects floats, NaN, and empty strings — parseInt would
    // silently truncate ("12.7" → 12) and accept trailing garbage ("10abc" → 10).
    let amount: number;
    try {
      amount = parseMinorUnits(dto.amount);
    } catch {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Amount must be an integer string in minor units',
      });
    }

    if (amount <= 0) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Amount must be greater than zero',
      });
    }

    // ── Idempotency (§8.3) ────────────────────────────────────────────────
    //
    // Two layers, and the second one is the one that actually holds.
    //
    // The read below is the fast path: a retry of a submission that already
    // landed returns the original result instead of a 409. But a read-then-write
    // check RACES — two identical submissions arriving together both see no row
    // and both insert.
    //
    // `idempotency_key_hash` closes that. Migration 00002 created
    // `idx_idempotency UNIQUE (created_by, idempotency_key_hash)`, and this hash
    // was being COMPUTED AND DISCARDED, so the column stayed NULL, the partial
    // index never matched anything, and the database-level guarantee §8.3 asks
    // for did not exist. Writing it means the second concurrent insert is
    // rejected by Postgres rather than by a check that already passed.
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

    const entryId = randomUUID();

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
        idempotency_key_hash: idempotencyHash,
        created_by: userId,
        posted_at: new Date().toISOString(),
        version: 1,
      })
      .select()
      .single();

    if (entryError) {
      // 23505 on this insert means the unique index caught a concurrent
      // duplicate — the other request won the race and its entry is the answer.
      // Returning it is what makes a double-submit idempotent rather than an
      // error the user has to interpret (§8.3).
      if (entryError.code === '23505') {
        const { data: winner } = await client
          .from('journal_entries')
          .select('*')
          .eq('created_by', userId)
          .eq('idempotency_key_hash', idempotencyHash)
          .single();

        if (winner) {
          const { data: postings } = await client
            .from('journal_postings')
            .select('*')
            .eq('journal_entry_id', winner.id);
          return { ...winner, postings: postings ?? [] };
        }
      }

      this.logger.error(
        `Failed to create journal entry: ${entryError.message}`,
      );
      throw new BadRequestException('Failed to create transaction');
    }

    // Get account info for currency
    const { data: account } = await client
      .from('ledger_accounts')
      .select('currency_code')
      .eq('id', dto.account_id)
      .single();

    const currencyCode = account?.currency_code || 'BDT';

    // A posting references the category's BACKING ledger account, never the
    // category id — they are different tables and journal_postings has an FK to
    // ledger_accounts (DEC-015). Passing the category id here made every
    // income/expense insert violate that FK.
    let categoryAccountId: string | undefined;
    if (dto.category_id) {
      categoryAccountId = await this.categoriesService.resolveLedgerAccountId(
        dto.category_id,
        workspaceId,
        accessToken,
      );
    }

    // Create balanced postings based on transaction type (§8.2)
    const postings = this.buildPostings(
      entryId,
      workspaceId,
      dto.type,
      amount,
      dto.account_id,
      categoryAccountId,
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

    // Handle tags — three round trips total, regardless of tag count (DEC-011).
    // This was previously a loop doing up to 3 queries *per tag*.
    if (dto.tags && dto.tags.length > 0) {
      const tagNames = [...new Set(dto.tags)];

      // 1. Upsert every tag in one statement. `tags` has UNIQUE (workspace_id,
      //    name), so existing tags are left alone and new ones are created.
      const { error: tagUpsertError } = await client.from('tags').upsert(
        tagNames.map((name) => ({
          id: randomUUID(),
          workspace_id: workspaceId,
          name,
        })),
        { onConflict: 'workspace_id,name', ignoreDuplicates: true },
      );

      if (tagUpsertError) {
        this.logger.error(`Failed to upsert tags: ${tagUpsertError.message}`);
      }

      // 2. Read back the ids (the upsert above cannot return rows it skipped).
      const { data: tagRows } = await client
        .from('tags')
        .select('id, name')
        .eq('workspace_id', workspaceId)
        .in('name', tagNames);

      // 3. Link them all at once. `workspace_id` is denormalised (migration
      //    00005) and sent explicitly — the trigger would supply it, but a
      //    column the compiler cannot see is a column that goes missing.
      if (tagRows && tagRows.length > 0) {
        const { error: linkError } = await client
          .from('journal_entry_tags')
          .insert(
            tagRows.map((tag) => ({
              journal_entry_id: entryId,
              workspace_id: workspaceId,
              tag_id: tag.id,
            })),
          );

        if (linkError) {
          this.logger.error(`Failed to link tags: ${linkError.message}`);
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
    categoryId?: string,
    tagId?: string,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);

    // ── Drill-down filter (Blueprint §5.3) ──────────────────────────────────
    // §5.3: "কোনো metric শুধু aggregate number দেখাবে না" — every figure must
    // lead to the entries behind it. That needs this filter, because a budget
    // line or a report slice is identified by CATEGORY.
    //
    // Resolved in two steps rather than with an `!inner` embed. An inner join
    // would return only the postings that matched, and the amount below is
    // computed by summing BOTH sides of the entry and halving — with half the
    // postings filtered away, every amount would come out at half its value.
    let entryIdFilter: string[] | undefined;
    if (categoryId) {
      const ledgerAccountId =
        await this.categoriesService.resolveLedgerAccountId(
          categoryId,
          workspaceId,
          accessToken,
        );

      const { data: matches } = await client
        .from('journal_postings')
        .select('journal_entry_id')
        .eq('workspace_id', workspaceId)
        .eq('ledger_account_id', ledgerAccountId);

      entryIdFilter = [
        ...new Set((matches ?? []).map((row) => row.journal_entry_id)),
      ];

      // No postings against that category means no transactions — returning
      // early avoids an `.in('id', [])`, which PostgREST treats as no filter at
      // all and would show the user the whole ledger instead of nothing.
      if (entryIdFilter.length === 0) {
        return { items: [], next_cursor: undefined, has_more: false };
      }
    }

    // ── Tag filter (§6.3) ───────────────────────────────────────────────────
    // Intersected with the category filter rather than replacing it, so
    // "housing, tagged #renovation" narrows as a user would expect instead of
    // one filter quietly winning.
    if (tagId) {
      const { data: tagged } = await client
        .from('journal_entry_tags')
        .select('journal_entry_id')
        .eq('workspace_id', workspaceId)
        .eq('tag_id', tagId);

      const taggedIds = new Set(
        (tagged ?? []).map((row) => row.journal_entry_id),
      );

      entryIdFilter = entryIdFilter
        ? entryIdFilter.filter((id) => taggedIds.has(id))
        : [...taggedIds];

      // Same trap as above: an empty `.in()` is no filter at all.
      if (entryIdFilter.length === 0) {
        return { items: [], next_cursor: undefined, has_more: false };
      }
    }

    let query = client
      .from('journal_entries')
      // Explicit columns, never `*`, on a list path (DEC-011). Single literal —
      // supabase-js infers the row type from it.
      //
      // Postings are embedded rather than fetched per row: the amount belongs to
      // the postings, not the entry (DEC-006), and a second round trip per entry
      // would be an N+1 on the hottest list in the app.
      //
      // `ledger_account_id` is embedded so the caller can name the category an
      // entry belongs to. A posting references the category's BACKING ledger
      // account, never the category id (DEC-015), so this is the only link.
      .select(
        'id, workspace_id, entry_type, occurred_at, local_date, payee, note, status, source, reverses_entry_id, created_by, posted_at, created_at, updated_at, version, journal_postings(ledger_account_id, debit_minor, credit_minor, currency_code)',
      )
      .eq('workspace_id', workspaceId)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1); // Fetch one extra for next cursor

    if (entryIdFilter) query = query.in('id', entryIdFilter);

    if (cursor) {
      // Cursor is the occurred_at of the last item
      query = query.lt('occurred_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to list transactions: ${error.message}`);
      throw new BadRequestException('Failed to list transactions');
    }

    // Each balanced entry has equal debits and credits, so the transaction's
    // magnitude is either side — summing both and halving avoids caring which.
    const withAmounts = (data || []).map((entry) => {
      const postings =
        (
          entry as unknown as {
            journal_postings?: {
              ledger_account_id: string;
              debit_minor: number;
              credit_minor: number;
              currency_code: string;
            }[];
          }
        ).journal_postings ?? [];

      const total = postings.reduce(
        (sum, p) => sum + p.debit_minor + p.credit_minor,
        0,
      );

      return {
        ...entry,
        amount_minor: Math.round(total / 2),
        currency_code: postings[0]?.currency_code ?? null,
        // Every account this entry touched. The caller matches these against
        // the category list it already has, so naming the category costs no
        // extra query.
        ledger_account_ids: postings.map((p) => p.ledger_account_id),
      };
    });

    // ── Which of these have been corrected? ──────────────────────────────
    // Derived, not stored (migration 00019): a reversal is an entry pointing at
    // its original, and the original stays POSTED so the two cancel. One extra
    // query bounded by the page size, rather than a `reversed` column that
    // would be a second source of truth able to drift from the ledger.
    const pageIds = withAmounts.map((entry) => entry.id);
    const reversedIds = new Set<string>();
    if (pageIds.length > 0) {
      const { data: reversals } = await client
        .from('journal_entries')
        .select('reverses_entry_id')
        .eq('workspace_id', workspaceId)
        .in('reverses_entry_id', pageIds);
      for (const row of reversals ?? []) {
        if (row.reverses_entry_id) reversedIds.add(row.reverses_entry_id);
      }
    }

    // The tags on this page, in ONE query rather than one per row. A tag is
    // shown on every transaction that carries it, so N+1 here would be N+1 on
    // the busiest list in the app.
    const tagsByEntry = new Map<string, string[]>();
    if (pageIds.length > 0) {
      const { data: links } = await client
        .from('journal_entry_tags')
        .select('journal_entry_id, tags(name)')
        .eq('workspace_id', workspaceId)
        .in('journal_entry_id', pageIds);

      for (const link of links ?? []) {
        const name = (link as { tags?: { name?: string } | null }).tags?.name;
        if (!name) continue;
        const list = tagsByEntry.get(link.journal_entry_id) ?? [];
        list.push(name);
        tagsByEntry.set(link.journal_entry_id, list);
      }
    }

    const entries = withAmounts.map((entry) => ({
      ...entry,
      reversed: reversedIds.has(entry.id),
      tags: (tagsByEntry.get(entry.id) ?? []).sort((a, b) =>
        a.localeCompare(b),
      ),
    }));
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
  async getTransaction(
    transactionId: string,
    workspaceId: string,
    accessToken: string,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);

    const { data: entry, error } = await client
      .from('journal_entries')
      .select('*')
      .eq('id', transactionId)
      .eq('workspace_id', workspaceId)
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
  /**
   * Every tag in a workspace, with how many entries carry it — §6.3.
   *
   * The COUNT is not decoration. A tag list without it cannot distinguish a
   * label in active use from one left behind by a typo, which is exactly the
   * decision someone opening this list is trying to make. It is also what
   * makes a delete safe to offer: "remove #grocries (0 uses)" is obviously
   * fine, "remove #groceries (214 uses)" obviously is not.
   *
   * Two queries rather than an aggregate join: PostgREST cannot GROUP BY, and
   * a per-tag count would be N+1 on a list that renders on every page load.
   */
  async listTags(workspaceId: string, accessToken: string) {
    const client = this.supabaseService.getUserClient(accessToken);

    const { data: tags, error } = await client
      .from('tags')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .order('name');

    if (error) {
      this.logger.error(`Failed to list tags: ${error.message}`);
      throw new BadRequestException('Failed to list tags');
    }

    const { data: links } = await client
      .from('journal_entry_tags')
      .select('tag_id')
      .eq('workspace_id', workspaceId);

    const counts = new Map<string, number>();
    for (const link of links ?? []) {
      counts.set(link.tag_id, (counts.get(link.tag_id) ?? 0) + 1);
    }

    return (tags ?? []).map((tag) => ({
      ...tag,
      usage_count: counts.get(tag.id) ?? 0,
    }));
  }

  /**
   * Delete a tag.
   *
   * Detaches it from every entry (`journal_entry_tags` cascades on `tag_id`)
   * and touches no posting. That distinction is the reason this is safe to
   * offer at all: a tag is a label, so removing one loses a way of FINDING
   * money, never the money itself.
   *
   * Migration 00020 added the DELETE policy this needs. Until then RLS
   * rejected every delete while returning success, so a tag simply would not
   * go away and nothing said why.
   */
  async deleteTag(tagId: string, workspaceId: string, accessToken: string) {
    const client = this.supabaseService.getUserClient(accessToken);

    const { data, error } = await client
      .from('tags')
      .delete()
      .eq('id', tagId)
      .eq('workspace_id', workspaceId)
      .select('id');

    if (error) {
      this.logger.error(`Failed to delete tag ${tagId}: ${error.message}`);
      throw new BadRequestException('Failed to delete tag');
    }

    // RLS returns success with zero rows for a tag in another workspace, so
    // the row count is the only way to tell "deleted" from "not yours".
    if (!data || data.length === 0) {
      throw new NotFoundException({
        code: 'TAG_NOT_FOUND',
        message: 'That tag does not exist in this workspace.',
      });
    }

    return { id: tagId };
  }

  /**
   * Reverse a posted transaction — FIN-03, "correction preserves history".
   *
   * ── WHY THIS IS ONE RPC AND NOT FOUR WRITES ──────────────────────────────
   * It used to be four sequential PostgREST calls with the last three's errors
   * discarded, and every gap between them corrupted the ledger silently:
   * a failed postings insert left a POSTED entry carrying no amount, and a
   * failed void left the original counted alongside its own reversal. It was
   * also racy — the POSTED check was a SELECT before an unconditional INSERT,
   * so two concurrent reversals both proceeded and produced two mirror entries
   * for one original.
   *
   * `reverse_journal_entry()` (migration 00019) does the whole thing in one
   * transaction and claims the entry with a conditional UPDATE, so the status
   * change IS the lock rather than a later side effect. It is SECURITY INVOKER,
   * so RLS remains the tenant boundary exactly as it is everywhere else.
   */
  async reverseTransaction(
    transactionId: string,
    workspaceId: string,
    _userId: string,
    accessToken: string,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);

    const { data: reversalId, error } = await client.rpc(
      'reverse_journal_entry',
      { p_entry_id: transactionId, p_workspace_id: workspaceId },
    );

    if (error) {
      // The function raises named exceptions so the API can map them to
      // something a user can act on, rather than surfacing a 500 for what is
      // usually "you already reversed this".
      if (error.message.includes('ENTRY_NOT_REVERSIBLE')) {
        throw new NotFoundException({
          code: 'TRANSACTION_NOT_REVERSIBLE',
          message:
            'That transaction is not available to reverse. It may already have ' +
            'been reversed, or it may not be posted.',
        });
      }
      if (error.message.includes('ENTRY_HAS_NO_POSTINGS')) {
        throw new BadRequestException({
          code: 'NO_POSTINGS',
          message: 'Original transaction has no postings',
        });
      }
      // A second reversal that somehow got past the claim hits the partial
      // unique index from 00019.
      if (error.code === '23505') {
        throw new BadRequestException({
          code: 'ALREADY_REVERSED',
          message: 'That transaction has already been reversed.',
        });
      }

      this.logger.error(
        `Failed to reverse ${transactionId}: ${error.code ?? 'no code'} ${error.message}`,
      );
      throw new BadRequestException({
        code: 'REVERSAL_FAILED',
        message: 'Could not reverse the transaction. Nothing was changed.',
      });
    }

    // Read back rather than returning what we hoped we wrote: the response is
    // the reversal as the database actually holds it, postings included.
    const { data: reversal } = await client
      .from('journal_entries')
      .select('*, journal_postings(*)')
      .eq('id', reversalId)
      .single();

    return reversal;
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
    /**
     * Denormalised onto every posting (migration 00005).
     *
     * The `derive_workspace_from_entry()` trigger would fill this in and would
     * ignore whatever we sent — but relying on that made the column invisible
     * to the type system, which is how it stayed absent from these inserts
     * unnoticed. Sending it explicitly means the code is correct with or
     * without the trigger, and the compiler can see that it is.
     */
    workspaceId: string,
    type: string,
    amount: number,
    accountId: string,
    /** Backing ledger account of the chosen category — NOT the category id. */
    categoryAccountId?: string,
    transferToId?: string,
    currencyCode = 'BDT',
  ) {
    const postings = [];

    switch (type) {
      case 'EXPENSE':
        if (!categoryAccountId) {
          throw new BadRequestException({
            code: 'CATEGORY_REQUIRED',
            message: 'Category is required for expense transactions',
          });
        }
        // Asset account credit (money goes out)
        postings.push({
          id: randomUUID(),
          journal_entry_id: entryId,
          workspace_id: workspaceId,
          ledger_account_id: accountId,
          debit_minor: 0,
          credit_minor: amount,
          currency_code: currencyCode,
          base_amount_minor: amount,
        });
        // Expense category debit (expense increases)
        postings.push({
          id: randomUUID(),
          journal_entry_id: entryId,
          workspace_id: workspaceId,
          ledger_account_id: categoryAccountId,
          debit_minor: amount,
          credit_minor: 0,
          currency_code: currencyCode,
          base_amount_minor: amount,
        });
        break;

      case 'INCOME':
        if (!categoryAccountId) {
          throw new BadRequestException({
            code: 'CATEGORY_REQUIRED',
            message: 'Category is required for income transactions',
          });
        }
        // Asset account debit (money comes in)
        postings.push({
          id: randomUUID(),
          journal_entry_id: entryId,
          workspace_id: workspaceId,
          ledger_account_id: accountId,
          debit_minor: amount,
          credit_minor: 0,
          currency_code: currencyCode,
          base_amount_minor: amount,
        });
        // Income category credit (income increases)
        postings.push({
          id: randomUUID(),
          journal_entry_id: entryId,
          workspace_id: workspaceId,
          ledger_account_id: categoryAccountId,
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
          id: randomUUID(),
          journal_entry_id: entryId,
          workspace_id: workspaceId,
          ledger_account_id: accountId,
          debit_minor: 0,
          credit_minor: amount,
          currency_code: currencyCode,
          base_amount_minor: amount,
        });
        // Destination account debit (money arrives)
        postings.push({
          id: randomUUID(),
          journal_entry_id: entryId,
          workspace_id: workspaceId,
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
