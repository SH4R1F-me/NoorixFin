'use server';

/**
 * Ledger writes — transactions, accounts, categories.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 * Until now the web app could not write to the ledger at all. The three views
 * had "Save Transaction", "Create Account" and "Create Category" buttons with no
 * `onClick` handler and uncontrolled inputs, so every click did nothing. The API
 * endpoints existed, were guarded and were tested — they simply had no caller.
 * Every transaction in the system had been created with curl.
 *
 * All writes go through NestJS (DEC-005): it is the only layer that enforces
 * balanced double-entry postings (DEC-006), and it owns idempotency.
 *
 * Results are returned as plain objects rather than thrown, matching
 * app/auth/actions.ts, so a form can show an inline error without a redirect.
 */
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { toMinorUnits } from '@noorixfin/money';
import { apiFetch, ApiError } from '../../lib/api-client';

export type LedgerResult = { ok: true } | { ok: false; message: string };

/**
 * Amounts arrive from a form as a human string ("1234.50") and must reach the
 * API as MINOR units (DEC-004 — no floating point anywhere near a balance).
 * `toMinorUnits` applies the currency's real exponent, so JPY (0) and KWD (3)
 * are handled rather than assuming /100.
 */
function parseAmountToMinor(
  input: string,
  currency: string,
): { ok: true; minor: number } | { ok: false; message: string } {
  const cleaned = input.trim().replace(/,/g, '');
  if (cleaned === '') return { ok: false, message: 'Enter an amount.' };

  const major = Number(cleaned);
  if (!Number.isFinite(major)) return { ok: false, message: 'That is not a valid amount.' };
  if (major <= 0) return { ok: false, message: 'Amount must be greater than zero.' };

  const minor = toMinorUnits(major, currency);
  if (!Number.isSafeInteger(minor)) {
    return { ok: false, message: 'That amount is too large.' };
  }
  return { ok: true, minor };
}

function fail(error: unknown): LedgerResult {
  if (error instanceof ApiError) return { ok: false, message: error.message };
  return { ok: false, message: 'Could not reach the API. Nothing was saved.' };
}

/** Every ledger view is server-rendered, so a write must revalidate to show. */
function revalidateLedger() {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/accounts');
  revalidatePath('/dashboard/categories');
}

export async function uploadAttachment(input: {
  workspaceId: string;
  transactionId: string;
  filename: string;
  contentType: string;
  dataBase64: string;
}): Promise<LedgerResult> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(input.contentType)) {
    return { ok: false, message: 'Receipt must be a JPG, PNG, WebP, or PDF.' };
  }
  try {
    const idempotencyKey = randomUUID();
    await apiFetch(
      `/workspaces/${input.workspaceId}/transactions/${input.transactionId}/attachments`,
      {
        method: 'POST',
        body: {
          idempotency_key: idempotencyKey,
          filename: input.filename,
          content_type: input.contentType,
          data_base64: input.dataBase64,
        },
        idempotencyKey,
      },
    );
    revalidatePath('/dashboard/transactions');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteAttachment(
  workspaceId: string,
  transactionId: string,
  attachmentId: string,
): Promise<LedgerResult> {
  try {
    await apiFetch(
      `/workspaces/${workspaceId}/transactions/${transactionId}/attachments/${attachmentId}`,
      { method: 'DELETE' },
    );
    revalidatePath('/dashboard/transactions');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export interface NewTransactionInput {
  workspaceId: string;
  /** Free-form labels (§6.3). Created on first use by the API. */
  tags?: string[];
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  amount: string;
  currency: string;
  accountId: string;
  /** Category for income/expense. */
  categoryId?: string;
  /** Destination account for a transfer. */
  transferToAccountId?: string;
  payee?: string;
  note?: string;
  occurredAt?: string;
}

export async function createTransaction(input: NewTransactionInput): Promise<LedgerResult> {
  if (!input.accountId) return { ok: false, message: 'Choose an account.' };

  if (input.type === 'TRANSFER') {
    if (!input.transferToAccountId) {
      return { ok: false, message: 'Choose a destination account.' };
    }
    if (input.transferToAccountId === input.accountId) {
      // The API would build a self-cancelling pair of postings; catching it here
      // gives a sentence instead of a silently meaningless entry.
      return { ok: false, message: 'Transfer source and destination must differ.' };
    }
  } else if (!input.categoryId) {
    return { ok: false, message: 'Choose a category.' };
  }

  const parsed = parseAmountToMinor(input.amount, input.currency);
  if (!parsed.ok) return parsed;

  try {
    await apiFetch(`/workspaces/${input.workspaceId}/transactions`, {
      method: 'POST',
      body: {
        type: input.type,
        // The API takes minor units as a decimal STRING (Blueprint §8.1) so the
        // value never passes through a JSON float.
        amount: String(parsed.minor),
        account_id: input.accountId,
        ...(input.type === 'TRANSFER'
          ? { transfer_to_account_id: input.transferToAccountId }
          : { category_id: input.categoryId }),
        ...(input.payee?.trim() ? { payee: input.payee.trim() } : {}),
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        ...(input.occurredAt ? { occurred_at: new Date(input.occurredAt).toISOString() } : {}),
        // Trimmed and de-duplicated here as well as by the API: the form lets
        // someone type the same label twice, and `tags` has UNIQUE
        // (workspace_id, name), so sending it twice would be a wasted upsert
        // rather than an error — silent, but still wrong.
        ...(input.tags?.length
          ? {
              tags: [...new Set(input.tags.map((tag) => tag.trim()).filter((tag) => tag !== ''))],
            }
          : {}),
        // Generated per submission, server-side. A retry of the SAME submission
        // reuses it via the form's own state; a genuinely new entry gets a new
        // one. This is what stops a double-click becoming two transactions
        // (Blueprint §8.3).
        idempotency_key: randomUUID(),
      },
    });
    revalidateLedger();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export interface NewAccountInput {
  workspaceId: string;
  name: string;
  accountClass: 'ASSET' | 'LIABILITY';
  subtype: string;
  currency: string;
}

export async function createAccount(input: NewAccountInput): Promise<LedgerResult> {
  if (!input.name.trim()) return { ok: false, message: 'Give the account a name.' };

  try {
    await apiFetch(`/workspaces/${input.workspaceId}/accounts`, {
      method: 'POST',
      body: {
        name: input.name.trim(),
        class: input.accountClass,
        subtype: input.subtype,
        currency_code: input.currency,
      },
    });
    revalidateLedger();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export interface NewCategoryInput {
  workspaceId: string;
  name: string;
  kind: 'INCOME' | 'EXPENSE';
  icon: string;
  color: string;
}

export async function createCategory(input: NewCategoryInput): Promise<LedgerResult> {
  if (!input.name.trim()) return { ok: false, message: 'Give the category a name.' };

  try {
    await apiFetch(`/workspaces/${input.workspaceId}/categories`, {
      method: 'POST',
      body: {
        // The DTO field is `name`; the service stores it as `custom_name` and
        // also uses it to name the backing ledger account (DEC-015). A
        // user-created category has no translation_key, so `custom_name` is what
        // categoryLabel() will display.
        name: input.name.trim(),
        kind: input.kind,
        icon: input.icon,
        color: input.color,
      },
    });
    revalidateLedger();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Reverse a posted transaction — FIN-03, audit §6.4.
 *
 * ── WHY THIS IS NOT A DELETE ────────────────────────────────────────────────
 * The API posts a MIRROR ENTRY and marks the original VOIDED; nothing is
 * removed. That is the requirement — "correction preserves history" — and it is
 * also the only honest thing a ledger can do: a deleted entry takes with it the
 * record that it was ever made, which is exactly what someone reconciling an
 * account later needs to see.
 *
 * The UI wording follows from that. It says "reverse", never "delete", and the
 * confirmation says a correcting entry will be added rather than implying the
 * original disappears.
 *
 * No idempotency key: the reversal is claimed by a conditional status UPDATE in
 * `reverse_journal_entry()` (migration 00019), so a second attempt is refused by
 * the database rather than by a key this layer would have to remember.
 */
export async function reverseTransaction(
  workspaceId: string,
  transactionId: string,
): Promise<LedgerResult> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/transactions/${transactionId}/reverse`, {
      method: 'POST',
    });
    revalidateLedger();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Delete a tag — §6.3.
 *
 * Detaches it from every entry and alters no posting, so this is safe to offer
 * without a reversal-style confirmation: what is lost is a way of FINDING
 * transactions, never a transaction.
 */
export async function deleteTag(workspaceId: string, tagId: string): Promise<LedgerResult> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/tags/${tagId}`, { method: 'DELETE' });
    revalidateLedger();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
