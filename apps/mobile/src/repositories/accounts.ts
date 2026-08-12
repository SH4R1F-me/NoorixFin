/**
 * Accounts repository — DEC-010.
 * All reads from local SQLite; writes enqueued for the API.
 */
import { getDb } from '../db';

export interface AccountRow {
  id: string;
  workspace_id: string;
  name: string;
  class: string;
  subtype: string;
  currency_code: string;
  normal_balance: string;
  include_in_net_worth: number;
  archived_at: string | null;
  balance_minor: number;
}

/** All active accounts with their current balance derived from postings. */
export async function listAccounts(workspaceId: string): Promise<AccountRow[]> {
  const db = await getDb();
  return db.getAllAsync<AccountRow>(
    `SELECT
       a.id, a.workspace_id, a.name, a.class, a.subtype, a.currency_code,
       a.normal_balance, a.include_in_net_worth, a.archived_at,
       COALESCE((
         SELECT
           CASE a.normal_balance
             WHEN 'DEBIT'  THEN SUM(p.debit_minor)  - SUM(p.credit_minor)
             WHEN 'CREDIT' THEN SUM(p.credit_minor) - SUM(p.debit_minor)
           END
         FROM journal_postings p
         JOIN journal_entries e ON e.id = p.journal_entry_id
         WHERE p.ledger_account_id = a.id AND e.status != 'VOIDED'
       ), 0) AS balance_minor
     FROM ledger_accounts a
     WHERE a.workspace_id = ? AND a.deleted_at IS NULL AND a.archived_at IS NULL
     ORDER BY a.class, a.subtype, a.name`,
    [workspaceId],
  );
}

/** Net worth: sum of all ASSET accounts minus all LIABILITY accounts. */
export async function getNetWorth(
  workspaceId: string,
): Promise<{ net_worth_minor: number; currency_code: string }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ net_worth_minor: number; currency_code: string }>(
    `SELECT
       COALESCE(SUM(
         CASE a.class
           WHEN 'ASSET'     THEN COALESCE(bal.balance_minor, 0)
           WHEN 'LIABILITY' THEN -COALESCE(bal.balance_minor, 0)
           ELSE 0
         END
       ), 0) AS net_worth_minor,
       COALESCE(MAX(a.currency_code), 'BDT') AS currency_code
     FROM ledger_accounts a
     LEFT JOIN (
       SELECT
         p.ledger_account_id,
         CASE a2.normal_balance
           WHEN 'DEBIT'  THEN SUM(p.debit_minor)  - SUM(p.credit_minor)
           WHEN 'CREDIT' THEN SUM(p.credit_minor) - SUM(p.debit_minor)
         END AS balance_minor
       FROM journal_postings p
       JOIN journal_entries e ON e.id = p.journal_entry_id AND e.status != 'VOIDED'
       JOIN ledger_accounts a2 ON a2.id = p.ledger_account_id
       GROUP BY p.ledger_account_id
     ) bal ON bal.ledger_account_id = a.id
     WHERE a.workspace_id = ?
       AND a.deleted_at IS NULL
       AND a.archived_at IS NULL
       AND a.include_in_net_worth = 1
       AND a.class IN ('ASSET', 'LIABILITY')`,
    [workspaceId],
  );
  return row ?? { net_worth_minor: 0, currency_code: 'BDT' };
}
