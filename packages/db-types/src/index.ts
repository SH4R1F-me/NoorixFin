/**
 * @noorixfin/db-types — the database's shape, generated from the migrations.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * Every `getUserClient()` in the API returned `SupabaseClient` with no generic,
 * so every `.from('journal_postings').select(...)` produced `any`. That was
 * ~105 `no-unsafe-*` lint errors, but the errors were the symptom. The disease
 * is that a whole class of mistake could not be caught before runtime:
 *
 *   - `category_id` vs `ledger_account_id` — a posting references a category's
 *     BACKING ledger account, never the category id (DEC-015). Passing the
 *     wrong one broke EVERY transaction write, and it type-checked cleanly
 *     because both are `any`.
 *   - `onboarding_status: 'PENDING'` — not in the CHECK constraint, so the
 *     insert could only ever fail with a 23514. Now a compile error, because
 *     the column's type is the union the constraint allows.
 *   - selecting a column that does not exist, which returns undefined at
 *     runtime and renders as a blank cell.
 *
 * ── KEEPING IT HONEST ────────────────────────────────────────────────────────
 * Generated from the LOCAL database after `supabase db reset`, so it reflects
 * the migrations rather than whatever a developer's instance happens to hold:
 *
 *     pnpm --filter @noorixfin/db-types generate
 *
 * `check:fresh` regenerates and diffs, and fails when the checked-in file is
 * stale. That check is what stops this becoming a lie — a types file that
 * drifts from the schema is worse than none, because it is trusted.
 */
export type { Database, Json } from './database.types';

import type { Database } from './database.types';

/** Row types, so call sites say `Tables<'budgets'>` instead of a long path. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type Insertable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type Updatable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

/** Return types of the SECURITY INVOKER aggregation functions. */
export type Functions<T extends keyof Database['public']['Functions']> =
  Database['public']['Functions'][T]['Returns'];
