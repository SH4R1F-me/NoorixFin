/**
 * Accounts Service — Blueprint §9.3, §8.2
 * Handles ledger account CRUD with opening balance as balanced journal entry.
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import { randomUUID } from 'crypto';

/** Default normal balance by account class */
const DEFAULT_NORMAL_BALANCE: Record<string, string> = {
  ASSET: 'DEBIT',
  LIABILITY: 'CREDIT',
  INCOME: 'CREDIT',
  EXPENSE: 'DEBIT',
  EQUITY: 'CREDIT',
};

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Create a new ledger account.
   * If opening_balance is provided, creates a balanced journal entry (§8.2).
   */
  async createAccount(
    workspaceId: string,
    userId: string,
    accessToken: string,
    dto: CreateAccountDto,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);

    // Get workspace currency if not specified
    let currencyCode: string = dto.currency_code || '';
    if (!currencyCode) {
      const { data: workspace } = await client
        .from('workspaces')
        .select('base_currency')
        .eq('id', workspaceId)
        .single();
      currencyCode = (workspace?.base_currency as string) || 'BDT';
    }

    const accountId = randomUUID();
    const normalBalance =
      dto.normal_balance || DEFAULT_NORMAL_BALANCE[dto.class] || 'DEBIT';

    const { data: account, error } = await client
      .from('ledger_accounts')
      .insert({
        id: accountId,
        workspace_id: workspaceId,
        name: dto.name,
        class: dto.class,
        subtype: dto.subtype,
        currency_code: currencyCode,
        normal_balance: normalBalance,
        include_in_budget: dto.include_in_budget ?? true,
        include_in_net_worth: dto.include_in_net_worth ?? true,
        opening_date:
          dto.opening_date || new Date().toISOString().split('T')[0],
        created_by: userId,
        version: 1,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create account: ${error.message}`);
      throw new BadRequestException('Failed to create account');
    }

    // Create opening balance journal entry if specified (§8.2)
    if (dto.opening_balance) {
      await this.createOpeningBalanceEntry(
        client,
        workspaceId,
        accountId,
        dto.class,
        normalBalance,
        parseInt(dto.opening_balance, 10),
        currencyCode,
        userId,
      );
    }

    return account;
  }

  /**
   * List all accounts for a workspace with computed balance.
   */
  async listAccounts(workspaceId: string, accessToken: string) {
    const client = this.supabaseService.getUserClient(accessToken);

    const { data: accounts, error } = await client
      .from('ledger_accounts')
      // Explicit columns, never `*`, on a list path (DEC-011 — egress counts).
      // Must be a single string literal: supabase-js infers row types from it,
      // and a concatenated expression degrades to GenericStringError.
      .select('id, workspace_id, name, class, subtype, currency_code, normal_balance, include_in_budget, include_in_net_worth, opening_date, archived_at, created_at, updated_at, version')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .is('deleted_at', null)
      .order('name');

    if (error) {
      this.logger.error(`Failed to list accounts: ${error.message}`);
      throw new BadRequestException('Failed to list accounts');
    }

    // Compute balances from journal postings
    const { data: postings } = await client
      .from('journal_postings')
      .select('ledger_account_id, debit_minor, credit_minor')
      .in(
        'ledger_account_id',
        (accounts || []).map((a) => a.id),
      );

    const balanceMap = new Map<string, number>();
    for (const posting of postings || []) {
      const current = balanceMap.get(posting.ledger_account_id) || 0;
      balanceMap.set(
        posting.ledger_account_id,
        current + (Number(posting.debit_minor) - Number(posting.credit_minor)),
      );
    }

    return (accounts || []).map((account) => {
      const rawBalance = balanceMap.get(account.id) || 0;
      // For CREDIT normal accounts (liability, income, equity), negate
      const balance =
        account.normal_balance === 'CREDIT' ? -rawBalance : rawBalance;
      return {
        ...account,
        balance: balance.toString(),
      };
    });
  }

  /**
   * Update an account (name, flags, archive).
   */
  async updateAccount(
    accountId: string,
    workspaceId: string,
    userId: string,
    accessToken: string,
    dto: UpdateAccountDto,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);

    const updatePayload: Record<string, unknown> = {};
    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.include_in_budget !== undefined)
      updatePayload.include_in_budget = dto.include_in_budget;
    if (dto.include_in_net_worth !== undefined)
      updatePayload.include_in_net_worth = dto.include_in_net_worth;
    if (dto.archived === true)
      updatePayload.archived_at = new Date().toISOString();
    if (dto.archived === false) updatePayload.archived_at = null;

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from('ledger_accounts')
      .update(updatePayload)
      .eq('id', accountId)
      // Scope the write to the guarded workspace so an id from another tenant
      // matches zero rows rather than relying on RLS to reject it.
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update account: ${error.message}`);
      throw new NotFoundException('Account not found');
    }

    return data;
  }

  /**
   * Create opening balance as balanced journal entry.
   * Blueprint §8.2: Asset/Liability account + Opening-balance equity
   */
  private async createOpeningBalanceEntry(
    client: ReturnType<SupabaseService['getUserClient']>,
    workspaceId: string,
    accountId: string,
    accountClass: string,
    normalBalance: string,
    amount: number,
    currencyCode: string,
    userId: string,
  ) {
    if (amount === 0) return;

    const entryId = randomUUID();
    const idempotencyKey = `opening-${accountId}`;

    // Create the journal entry
    const { error: entryError } = await client.from('journal_entries').insert({
      id: entryId,
      workspace_id: workspaceId,
      entry_type: 'OPENING',
      occurred_at: new Date().toISOString(),
      local_date: new Date().toISOString().split('T')[0],
      note: 'Opening balance',
      status: 'POSTED',
      source: 'SYSTEM',
      client_entry_id: randomUUID(),
      created_by: userId,
      posted_at: new Date().toISOString(),
      version: 1,
    });

    if (entryError) {
      this.logger.error(
        `Failed to create opening balance entry: ${entryError.message}`,
      );
      return; // Don't fail account creation for opening balance
    }

    // Get or create the opening balance equity account
    let { data: equityAccount } = await client
      .from('ledger_accounts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('subtype', 'SYSTEM')
      .eq('class', 'EQUITY')
      .eq('name', 'Opening Balance Equity')
      .single();

    if (!equityAccount) {
      const equityId = randomUUID();
      const { data: created } = await client
        .from('ledger_accounts')
        .insert({
          id: equityId,
          workspace_id: workspaceId,
          name: 'Opening Balance Equity',
          class: 'EQUITY',
          subtype: 'SYSTEM',
          currency_code: currencyCode,
          normal_balance: 'CREDIT',
          include_in_budget: false,
          include_in_net_worth: false,
          created_by: userId,
          version: 1,
        })
        .select()
        .single();
      equityAccount = created;
    }

    if (!equityAccount) return;

    const absAmount = Math.abs(amount);

    // For DEBIT-normal accounts (ASSET, EXPENSE): debit the account, credit equity
    // For CREDIT-normal accounts (LIABILITY, INCOME): credit the account, debit equity
    const postings = [
      {
        id: randomUUID(),
        journal_entry_id: entryId,
        ledger_account_id: accountId,
        debit_minor: normalBalance === 'DEBIT' ? absAmount : 0,
        credit_minor: normalBalance === 'CREDIT' ? absAmount : 0,
        currency_code: currencyCode,
        base_amount_minor: absAmount,
      },
      {
        id: randomUUID(),
        journal_entry_id: entryId,
        ledger_account_id: equityAccount.id,
        debit_minor: normalBalance === 'CREDIT' ? absAmount : 0,
        credit_minor: normalBalance === 'DEBIT' ? absAmount : 0,
        currency_code: currencyCode,
        base_amount_minor: absAmount,
      },
    ];

    const { error: postingError } = await client
      .from('journal_postings')
      .insert(postings);

    if (postingError) {
      this.logger.error(
        `Failed to create opening balance postings: ${postingError.message}`,
      );
    }
  }
}
