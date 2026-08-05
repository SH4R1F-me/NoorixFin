/**
 * Categories Service — Blueprint §9.3, DEC-015
 *
 * Rewritten: the previous implementation targeted a schema that does not exist
 * (`is_system`, `name`, `type`) and never supplied the NOT NULL
 * `ledger_account_id`, so every insert and the list query failed at runtime.
 *
 * The model (DEC-015):
 *   - Every category is workspace-scoped. `workspace_id` is nullable in the
 *     schema, but a category MUST reference a ledger account and ledger accounts
 *     are workspace-scoped — so a global category could not be posted against.
 *   - "System" is not a column: a category is system-provided iff
 *     `translation_key IS NOT NULL`. Display name is
 *     `custom_name ?? t(translation_key)`, resolved by the client.
 *   - Each category owns a backing `ledger_accounts` row of subtype CATEGORY.
 *     Postings reference THAT account, never the category id.
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { Updatable } from '@noorixfin/db-types';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { randomUUID } from 'crypto';
import { ACCOUNT_CLASS_NORMAL_BALANCE } from '@noorixfin/domain';

/** Columns actually present on `categories` (migration 00002 + 00005). */
const CATEGORY_COLUMNS =
  'id, workspace_id, ledger_account_id, kind, parent_id, translation_key, custom_name, icon, color, sort_order, archived_at, deleted_at, created_at, updated_at';

/**
 * System category catalogue. `translation_key` is the identity — it is what
 * makes seeding idempotent and what the client translates for display.
 * `fallbackName` names the backing ledger account (accounts need a name) and is
 * never shown to the user.
 */
const SYSTEM_CATEGORIES: ReadonlyArray<{
  translation_key: string;
  kind: 'INCOME' | 'EXPENSE';
  icon: string;
  color: string;
  fallbackName: string;
}> = [
  {
    translation_key: 'cat.food_dining',
    kind: 'EXPENSE',
    icon: '🍕',
    color: '#f59e0b',
    fallbackName: 'Food & Dining',
  },
  {
    translation_key: 'cat.transport',
    kind: 'EXPENSE',
    icon: '🚗',
    color: '#3b82f6',
    fallbackName: 'Transport',
  },
  {
    translation_key: 'cat.housing',
    kind: 'EXPENSE',
    icon: '🏠',
    color: '#8b5cf6',
    fallbackName: 'Housing',
  },
  {
    translation_key: 'cat.utilities',
    kind: 'EXPENSE',
    icon: '💡',
    color: '#06b6d4',
    fallbackName: 'Utilities',
  },
  {
    translation_key: 'cat.healthcare',
    kind: 'EXPENSE',
    icon: '🏥',
    color: '#ef4444',
    fallbackName: 'Healthcare',
  },
  {
    translation_key: 'cat.education',
    kind: 'EXPENSE',
    icon: '📚',
    color: '#6366f1',
    fallbackName: 'Education',
  },
  {
    translation_key: 'cat.entertainment',
    kind: 'EXPENSE',
    icon: '🎮',
    color: '#ec4899',
    fallbackName: 'Entertainment',
  },
  {
    translation_key: 'cat.shopping',
    kind: 'EXPENSE',
    icon: '🛍️',
    color: '#f97316',
    fallbackName: 'Shopping',
  },
  {
    translation_key: 'cat.personal_care',
    kind: 'EXPENSE',
    icon: '💇',
    color: '#14b8a6',
    fallbackName: 'Personal Care',
  },
  {
    translation_key: 'cat.gifts_donations',
    kind: 'EXPENSE',
    icon: '🎁',
    color: '#a855f7',
    fallbackName: 'Gifts & Donations',
  },
  {
    translation_key: 'cat.other_expense',
    kind: 'EXPENSE',
    icon: '📦',
    color: '#6b7785',
    fallbackName: 'Other Expense',
  },
  {
    translation_key: 'cat.salary',
    kind: 'INCOME',
    icon: '💰',
    color: '#10b981',
    fallbackName: 'Salary',
  },
  {
    translation_key: 'cat.business',
    kind: 'INCOME',
    icon: '🏢',
    color: '#059669',
    fallbackName: 'Business',
  },
  {
    translation_key: 'cat.freelance',
    kind: 'INCOME',
    icon: '💻',
    color: '#0ea5e9',
    fallbackName: 'Freelance',
  },
  {
    translation_key: 'cat.investment',
    kind: 'INCOME',
    icon: '📈',
    color: '#22c55e',
    fallbackName: 'Investment',
  },
  {
    translation_key: 'cat.other_income',
    kind: 'INCOME',
    icon: '💵',
    color: '#84cc16',
    fallbackName: 'Other Income',
  },
];

/** Postgres unique-violation. Benign here: a concurrent seeder got there first. */
function isUniqueViolation(error: { code?: string }): boolean {
  return error?.code === '23505';
}

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Seed the system catalogue into a workspace. Idempotent: relies on the
   * partial unique indexes from migration 00006, so two concurrent first
   * requests cannot double-seed.
   */
  async seedSystemCategories(
    workspaceId: string,
    userId: string,
    accessToken: string,
  ): Promise<void> {
    const client = this.supabaseService.getUserClient(accessToken);

    const { data: existing } = await client
      .from('categories')
      .select('translation_key')
      .eq('workspace_id', workspaceId)
      .not('translation_key', 'is', null);

    const seeded = new Set(
      (existing ?? []).map(
        (row: { translation_key: string | null }) => row.translation_key,
      ),
    );
    const missing = SYSTEM_CATEGORIES.filter(
      (c) => !seeded.has(c.translation_key),
    );
    if (missing.length === 0) return;

    // Categories post into ledger accounts, so each one needs a backing account
    // in this workspace, in the workspace's currency.
    const { data: workspace } = await client
      .from('workspaces')
      .select('base_currency')
      .eq('id', workspaceId)
      .single();

    const currencyCode = workspace?.base_currency ?? 'BDT';

    // NOTE: plain INSERT, not upsert. The uniqueness guarantees from migration
    // 00006 are PARTIAL indexes (`WHERE subtype = 'CATEGORY'` and
    // `WHERE translation_key IS NOT NULL`), and PostgreSQL will not accept a
    // partial index as an ON CONFLICT target unless the statement repeats the
    // predicate — which PostgREST's `on_conflict` parameter cannot express.
    // Using upsert here failed with:
    //   "there is no unique or exclusion constraint matching the ON CONFLICT
    //    specification"
    // Instead: insert only what is missing and treat a unique violation (23505)
    // as a concurrent seeder having won the race, which is benign.

    // Some accounts may already exist from a partially-completed earlier run.
    const { data: existingAccounts } = await client
      .from('ledger_accounts')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .eq('subtype', 'CATEGORY')
      .in(
        'name',
        missing.map((c) => c.fallbackName),
      );

    const haveAccount = new Set(
      (existingAccounts ?? []).map((a: { name: string }) => a.name),
    );
    const accountRows = missing
      .filter((cat) => !haveAccount.has(cat.fallbackName))
      .map((cat) => ({
        id: randomUUID(),
        workspace_id: workspaceId,
        name: cat.fallbackName,
        class: cat.kind,
        subtype: 'CATEGORY',
        currency_code: currencyCode,
        normal_balance: ACCOUNT_CLASS_NORMAL_BALANCE[cat.kind],
        include_in_budget: cat.kind === 'EXPENSE',
        include_in_net_worth: false,
        created_by: userId,
      }));

    if (accountRows.length > 0) {
      const { error: accountError } = await client
        .from('ledger_accounts')
        .insert(accountRows);

      if (accountError && !isUniqueViolation(accountError)) {
        this.logger.error(
          `Failed to seed category accounts: ${accountError.message}`,
        );
        throw new BadRequestException({
          code: 'CATEGORY_SEED_FAILED',
          message: 'Failed to prepare category accounts',
        });
      }
    }

    // Read back — covers both the rows just inserted and any a concurrent
    // request created first.
    const { data: accounts } = await client
      .from('ledger_accounts')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .eq('subtype', 'CATEGORY')
      .in(
        'name',
        missing.map((c) => c.fallbackName),
      );

    const accountByName = new Map(
      (accounts ?? []).map((a: { id: string; name: string }) => [a.name, a.id]),
    );

    const categoryRows = missing
      .filter((cat) => accountByName.has(cat.fallbackName))
      .map((cat, idx) => ({
        id: randomUUID(),
        workspace_id: workspaceId,
        ledger_account_id: accountByName.get(cat.fallbackName)!,
        kind: cat.kind,
        translation_key: cat.translation_key,
        custom_name: null,
        icon: cat.icon,
        color: cat.color,
        sort_order: idx,
      }));

    if (categoryRows.length === 0) return;

    const { error } = await client.from('categories').insert(categoryRows);

    if (error && !isUniqueViolation(error)) {
      this.logger.error(`Failed to seed system categories: ${error.message}`);
      throw new BadRequestException({
        code: 'CATEGORY_SEED_FAILED',
        message: 'Failed to seed system categories',
      });
    }
  }

  /**
   * List a workspace's categories, seeding the system catalogue on first call.
   */
  async listCategories(
    workspaceId: string,
    userId: string,
    accessToken: string,
    kind?: string,
  ) {
    await this.seedSystemCategories(workspaceId, userId, accessToken);

    const client = this.supabaseService.getUserClient(accessToken);

    let query = client
      .from('categories')
      .select(CATEGORY_COLUMNS)
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .is('deleted_at', null)
      // No `name` column to sort by — display name is resolved client-side from
      // custom_name / translation_key, so ordering is by sort_order.
      .order('kind', { ascending: true })
      .order('sort_order', { ascending: true });

    if (kind) {
      query = query.eq('kind', kind);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to list categories: ${error.message}`);
      throw new BadRequestException('Failed to list categories');
    }

    return data ?? [];
  }

  /**
   * Create a custom (user-defined) category and its backing ledger account.
   */
  async createCategory(
    workspaceId: string,
    userId: string,
    accessToken: string,
    dto: CreateCategoryDto,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);

    if (dto.parent_id) {
      const { data: parent, error: parentError } = await client
        .from('categories')
        .select('id, kind')
        .eq('id', dto.parent_id)
        .eq('workspace_id', workspaceId)
        .single();

      if (parentError || !parent) {
        throw new NotFoundException({
          code: 'PARENT_CATEGORY_NOT_FOUND',
          message: 'Parent category not found in this workspace',
        });
      }

      if (parent.kind !== dto.kind) {
        throw new BadRequestException({
          code: 'CATEGORY_KIND_MISMATCH',
          message: 'A child category must have the same kind as its parent',
        });
      }
    }

    const { data: workspace } = await client
      .from('workspaces')
      .select('base_currency')
      .eq('id', workspaceId)
      .single();

    const accountId = randomUUID();
    const { error: accountError } = await client
      .from('ledger_accounts')
      .insert({
        id: accountId,
        workspace_id: workspaceId,
        name: dto.name,
        class: dto.kind,
        subtype: 'CATEGORY',
        currency_code: workspace?.base_currency ?? 'BDT',
        normal_balance: ACCOUNT_CLASS_NORMAL_BALANCE[dto.kind],
        include_in_budget: dto.kind === 'EXPENSE',
        include_in_net_worth: false,
        created_by: userId,
      });

    if (accountError) {
      this.logger.error(
        `Failed to create category account: ${accountError.message}`,
      );
      throw new BadRequestException({
        code: 'CATEGORY_CREATE_FAILED',
        message: 'Failed to create the category ledger account',
      });
    }

    const { data, error } = await client
      .from('categories')
      .insert({
        id: randomUUID(),
        workspace_id: workspaceId,
        ledger_account_id: accountId,
        kind: dto.kind,
        parent_id: dto.parent_id ?? null,
        // User-created categories carry a literal name, not a translation key.
        translation_key: null,
        custom_name: dto.name,
        icon: dto.icon ?? '📦',
        color: dto.color ?? '#6B7785',
        sort_order: dto.sort_order ?? 0,
      })
      .select(CATEGORY_COLUMNS)
      .single();

    if (error) {
      this.logger.error(`Failed to create category: ${error.message}`);
      // Roll back the orphaned account so a retry does not hit the unique index.
      await client.from('ledger_accounts').delete().eq('id', accountId);
      throw new BadRequestException({
        code: 'CATEGORY_CREATE_FAILED',
        message: 'Failed to create category',
      });
    }

    return data;
  }

  /**
   * Update a category. `kind` and `ledger_account_id` are immutable — changing
   * either would reinterpret every posting already made against it.
   */
  async updateCategory(
    categoryId: string,
    workspaceId: string,
    accessToken: string,
    dto: UpdateCategoryDto,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);

    const { data: existing, error: findError } = await client
      .from('categories')
      .select('id, translation_key')
      .eq('id', categoryId)
      .eq('workspace_id', workspaceId)
      .single();

    if (findError || !existing) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Category not found in this workspace',
      });
    }

    const patch: Updatable<'categories'> = {};
    // Renaming a system category sets custom_name, which overrides the
    // translation. translation_key is kept so the row stays identifiable.
    if (dto.name !== undefined) patch.custom_name = dto.name;
    if (dto.icon !== undefined) patch.icon = dto.icon;
    if (dto.color !== undefined) patch.color = dto.color;
    if (dto.parent_id !== undefined) patch.parent_id = dto.parent_id;
    if (dto.sort_order !== undefined) patch.sort_order = dto.sort_order;
    if (dto.archived !== undefined) {
      patch.archived_at = dto.archived ? new Date().toISOString() : null;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException({
        code: 'NO_CHANGES',
        message: 'No updatable fields were provided',
      });
    }

    const { data, error } = await client
      .from('categories')
      .update(patch)
      .eq('id', categoryId)
      .eq('workspace_id', workspaceId)
      .select(CATEGORY_COLUMNS)
      .single();

    if (error) {
      this.logger.error(`Failed to update category: ${error.message}`);
      throw new BadRequestException('Failed to update category');
    }

    return data;
  }

  /**
   * Resolve a category to the ledger account postings must reference.
   * Blueprint §8.2: a posting's ledger_account_id is the category's BACKING
   * account, never the category id — they are different tables.
   */
  async resolveLedgerAccountId(
    categoryId: string,
    workspaceId: string,
    accessToken: string,
  ): Promise<string> {
    const client = this.supabaseService.getUserClient(accessToken);

    const { data, error } = await client
      .from('categories')
      .select('ledger_account_id')
      .eq('id', categoryId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !data?.ledger_account_id) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Category not found in this workspace',
      });
    }

    return data.ledger_account_id;
  }
}
