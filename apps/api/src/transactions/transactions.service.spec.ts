/**
 * Transactions service — ledger engine tests.
 *
 * Context: `apps/api` had 37 source files and ZERO tests. The double-entry
 * engine — the piece that must never be wrong — had never been executed by
 * anything. These tests drive the real service with a mocked Supabase client,
 * so the posting construction, validation, and idempotency paths run for real.
 *
 * NOT covered here (needs PostgREST, so `supabase start`): RLS enforcement,
 * the database CHECK constraints, and true cross-request idempotency. Those are
 * verified at the DB layer by supabase/tests/run-local.sh.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { CategoriesService } from '../categories/categories.service';
import type { CreateTransactionDto } from './dto/transaction.dto';

const WORKSPACE = '11111111-1111-1111-1111-111111111111';
const USER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CASH_ACCOUNT = '33333333-3333-3333-3333-333333333333';
const DEST_ACCOUNT = '44444444-4444-4444-4444-444444444444';
const CATEGORY = '55555555-5555-5555-5555-555555555555';
const CATEGORY_ACCOUNT = '66666666-6666-6666-6666-666666666666';

interface Posting {
  ledger_account_id: string;
  debit_minor: number;
  credit_minor: number;
  base_amount_minor: number;
  currency_code: string;
}

/**
 * Minimal Supabase query-builder stand-in.
 *
 * `capturedPostings` is what we actually assert on — it is the set of rows the
 * service tried to write to `journal_postings`.
 */
function makeClient() {
  const capturedPostings: Posting[] = [];
  let existingEntry: unknown = null;

  const builder = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;

    Object.assign(chain, {
      select: self,
      eq: self,
      in: self,
      not: self,
      is: self,
      order: self,
      limit: self,
      upsert: () => Promise.resolve({ data: [], error: null }),
      delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      single: () => {
        if (table === 'journal_entries') {
          return Promise.resolve({ data: existingEntry, error: existingEntry ? null : { message: 'none' } });
        }
        if (table === 'ledger_accounts') {
          return Promise.resolve({ data: { currency_code: 'BDT' }, error: null });
        }
        return Promise.resolve({ data: null, error: { message: 'none' } });
      },
      insert: (rows: unknown) => {
        if (table === 'journal_postings') {
          capturedPostings.push(...(rows as Posting[]));
        }
        return {
          select: () => ({
            single: () =>
              Promise.resolve({ data: { id: 'entry-1', workspace_id: WORKSPACE }, error: null }),
            then: (resolve: (v: unknown) => unknown) =>
              resolve({ data: rows, error: null }),
          }),
          then: (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null }),
        };
      },
    });
    return chain;
  };

  return {
    capturedPostings,
    setExistingEntry: (e: unknown) => { existingEntry = e; },
    client: { from: (table: string) => builder(table) },
  };
}

function makeService(categoryAccountId: string | null = CATEGORY_ACCOUNT) {
  const mock = makeClient();

  const supabase = {
    getUserClient: () => mock.client,
  } as unknown as SupabaseService;

  const categories = {
    resolveLedgerAccountId: jest.fn(async () => {
      if (!categoryAccountId) {
        throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'not found' });
      }
      return categoryAccountId;
    }),
  } as unknown as CategoriesService;

  return { service: new TransactionsService(supabase, categories), mock, categories };
}

function baseDto(overrides: Partial<CreateTransactionDto> = {}): CreateTransactionDto {
  return {
    type: 'EXPENSE',
    amount: '5000',
    account_id: CASH_ACCOUNT,
    category_id: CATEGORY,
    idempotency_key: '77777777-7777-7777-7777-777777777777',
    ...overrides,
  } as CreateTransactionDto;
}

const sum = (rows: Posting[], key: 'debit_minor' | 'credit_minor') =>
  rows.reduce((total, row) => total + row[key], 0);

describe('TransactionsService — ledger engine', () => {
  describe('FIN-01: every entry balances (debits === credits)', () => {
    it.each([
      ['EXPENSE', baseDto({ type: 'EXPENSE' })],
      ['INCOME', baseDto({ type: 'INCOME' })],
      ['TRANSFER', baseDto({ type: 'TRANSFER', category_id: undefined, transfer_to_account_id: DEST_ACCOUNT })],
    ])('%s postings balance', async (_label, dto) => {
      const { service, mock } = makeService();
      await service.createTransaction(WORKSPACE, USER, 'token', dto);

      const postings = mock.capturedPostings;
      expect(postings).toHaveLength(2);
      expect(sum(postings, 'debit_minor')).toBe(sum(postings, 'credit_minor'));
      expect(sum(postings, 'debit_minor')).toBe(5000);
    });

    it('holds across a range of amounts', async () => {
      for (const amount of ['1', '7', '99', '100000', '999999999']) {
        const { service, mock } = makeService();
        await service.createTransaction(WORKSPACE, USER, 'token', baseDto({ amount }));
        expect(sum(mock.capturedPostings, 'debit_minor')).toBe(
          sum(mock.capturedPostings, 'credit_minor'),
        );
      }
    });

    it('never emits a posting with both sides positive (DB chk_posting_sides)', async () => {
      const { service, mock } = makeService();
      await service.createTransaction(WORKSPACE, USER, 'token', baseDto());
      for (const p of mock.capturedPostings) {
        expect(p.debit_minor > 0 && p.credit_minor > 0).toBe(false);
      }
    });

    it('never emits a zero-only posting (DB chk_posting_nonzero)', async () => {
      const { service, mock } = makeService();
      await service.createTransaction(WORKSPACE, USER, 'token', baseDto());
      for (const p of mock.capturedPostings) {
        expect(p.debit_minor > 0 || p.credit_minor > 0).toBe(true);
      }
    });
  });

  describe('DEC-015: postings reference the category ACCOUNT, not the category', () => {
    it('resolves the category to its backing ledger account', async () => {
      const { service, mock, categories } = makeService();
      await service.createTransaction(WORKSPACE, USER, 'token', baseDto());

      expect(categories.resolveLedgerAccountId).toHaveBeenCalledWith(CATEGORY, WORKSPACE, 'token');

      const accountIds = mock.capturedPostings.map((p) => p.ledger_account_id);
      expect(accountIds).toContain(CATEGORY_ACCOUNT);
      // The regression this guards: passing the category id straight through
      // violates the FK on journal_postings.ledger_account_id.
      expect(accountIds).not.toContain(CATEGORY);
    });

    it('surfaces a missing category rather than posting against nothing', async () => {
      const { service } = makeService(null);
      await expect(
        service.createTransaction(WORKSPACE, USER, 'token', baseDto()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('DEC-004: amount parsing rejects what parseInt would accept', () => {
    it.each(['12.7', '10abc', '', 'abc', 'NaN', '1e3'])('rejects %p', async (amount) => {
      const { service } = makeService();
      await expect(
        service.createTransaction(WORKSPACE, USER, 'token', baseDto({ amount })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each(['0', '-1', '-5000'])('rejects non-positive %p', async (amount) => {
      const { service } = makeService();
      await expect(
        service.createTransaction(WORKSPACE, USER, 'token', baseDto({ amount })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a well-formed minor-unit string', async () => {
      const { service, mock } = makeService();
      await service.createTransaction(WORKSPACE, USER, 'token', baseDto({ amount: '1025' }));
      expect(sum(mock.capturedPostings, 'debit_minor')).toBe(1025);
    });
  });

  describe('required fields per entry type', () => {
    it('EXPENSE without a category is rejected', async () => {
      const { service } = makeService();
      await expect(
        service.createTransaction(WORKSPACE, USER, 'token', baseDto({ category_id: undefined })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('TRANSFER without a destination is rejected', async () => {
      const { service } = makeService();
      await expect(
        service.createTransaction(
          WORKSPACE,
          USER,
          'token',
          baseDto({ type: 'TRANSFER', category_id: undefined, transfer_to_account_id: undefined }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('an unknown entry type is rejected', async () => {
      const { service } = makeService();
      await expect(
        service.createTransaction(
          WORKSPACE,
          USER,
          'token',
          baseDto({ type: 'GIFT' as CreateTransactionDto['type'] }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('FIN-02: idempotency', () => {
    it('returns the existing entry and writes no new postings on replay', async () => {
      const { service, mock } = makeService();
      mock.setExistingEntry({ id: 'existing-entry', workspace_id: WORKSPACE });

      const result = await service.createTransaction(WORKSPACE, USER, 'token', baseDto());

      expect((result as { id: string }).id).toBe('existing-entry');
      expect(mock.capturedPostings).toHaveLength(0);
    });
  });

  describe('TRANSFER direction', () => {
    it('credits the source and debits the destination', async () => {
      const { service, mock } = makeService();
      await service.createTransaction(
        WORKSPACE,
        USER,
        'token',
        baseDto({ type: 'TRANSFER', category_id: undefined, transfer_to_account_id: DEST_ACCOUNT }),
      );

      const source = mock.capturedPostings.find((p) => p.ledger_account_id === CASH_ACCOUNT);
      const destination = mock.capturedPostings.find((p) => p.ledger_account_id === DEST_ACCOUNT);

      // Money leaving an asset account is a credit; arriving is a debit.
      expect(source).toMatchObject({ credit_minor: 5000, debit_minor: 0 });
      expect(destination).toMatchObject({ debit_minor: 5000, credit_minor: 0 });
    });
  });
});
