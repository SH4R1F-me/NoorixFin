/**
 * Transaction repository — DEC-010, DEC-012.
 *
 * ALL reads hit local SQLite, never the network. That is what makes the app
 * both instant and offline-capable in one stroke: a screen renders from disk
 * before any request is made, and works identically with the radio off.
 *
 * Writes go to SQLite first (optimistic, `is_pending = 1`) and are enqueued for
 * the API. The authoritative row replaces the local one on the next pull.
 */
import { randomUUID } from 'expo-crypto';
import { getDb } from '../db';
import { enqueue } from '../sync/queue';

export interface TransactionRow {
  id: string;
  workspace_id: string;
  entry_type: string;
  occurred_at: string;
  local_date: string;
  payee: string | null;
  note: string | null;
  status: string;
  is_pending: number;
  amount_minor: number;
  currency_code: string;
}

/**
 * Recent transactions with their signed amount, derived from the postings.
 *
 * The amount is computed from the ledger rather than stored on the entry —
 * the postings are the source of truth (DEC-006), so summing them here keeps
 * the list honest even if an entry is later reversed.
 */
export async function listRecent(
  workspaceId: string,
  limit = 50,
): Promise<TransactionRow[]> {
  const db = await getDb();
  return db.getAllAsync<TransactionRow>(
    `SELECT
       e.id, e.workspace_id, e.entry_type, e.occurred_at, e.local_date,
       e.payee, e.note, e.status, e.is_pending,
       COALESCE((
         SELECT SUM(p.debit_minor + p.credit_minor) / 2
           FROM journal_postings p
          WHERE p.journal_entry_id = e.id
       ), 0) AS amount_minor,
       COALESCE((
         SELECT p.currency_code FROM journal_postings p
          WHERE p.journal_entry_id = e.id LIMIT 1
       ), 'BDT') AS currency_code
     FROM journal_entries e
     WHERE e.workspace_id = ? AND e.status != 'VOIDED'
     ORDER BY e.occurred_at DESC, e.id DESC
     LIMIT ?`,
    [workspaceId, limit],
  );
}

export interface CreateTransactionInput {
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  amount: string;
  account_id: string;
  category_id?: string;
  transfer_to_account_id?: string;
  payee?: string;
  note?: string;
  occurred_at?: string;
}

/**
 * Create a transaction offline-first.
 *
 * The returned id is the client-generated UUID, reused as the queue id and the
 * Idempotency-Key — so a retry after an ambiguous network failure resolves to
 * the same server row rather than a duplicate (FIN-02).
 *
 * NOTE: only the journal ENTRY is written locally, not its postings. Postings
 * must balance (DEC-006) and only the server can build them correctly — the
 * category has to be resolved to its backing ledger account (DEC-015), which
 * needs data this device may not have. The list therefore shows a pending row
 * with the amount the user typed, and the real postings arrive on the pull.
 */
export async function createTransaction(
  workspaceId: string,
  input: CreateTransactionInput,
): Promise<string> {
  const db = await getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const occurredAt = input.occurred_at ?? now;

  await db.runAsync(
    `INSERT INTO journal_entries
       (id, workspace_id, entry_type, occurred_at, local_date, payee, note,
        status, source, client_entry_id, created_at, updated_at, version, is_pending)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'POSTED', 'MANUAL', ?, ?, ?, 1, 1)`,
    [
      id,
      workspaceId,
      input.type,
      occurredAt,
      occurredAt.split('T')[0]!,
      input.payee ?? null,
      input.note ?? null,
      id,
      now,
      now,
    ],
  );

  await enqueue(id, workspaceId, 'CREATE_TRANSACTION', {
    type: input.type,
    amount: input.amount,
    account_id: input.account_id,
    category_id: input.category_id,
    transfer_to_account_id: input.transfer_to_account_id,
    payee: input.payee,
    note: input.note,
    occurred_at: occurredAt,
  });

  return id;
}
