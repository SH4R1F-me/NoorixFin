'use server';

import { Buffer } from 'node:buffer';
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '../../../lib/api-client';

export type ImportResult =
  { ok: true; imported: number; failed: number } | { ok: false; message: string };

export async function startImport(input: {
  workspaceId: string;
  format: 'CSV' | 'OFX' | 'QIF';
  filename: string;
  content: string;
  accountId: string;
  expenseCategoryId: string;
  incomeCategoryId?: string;
  idempotencyKey: string;
}): Promise<ImportResult> {
  if (!input.workspaceId || !input.accountId || !input.expenseCategoryId) {
    return { ok: false, message: 'Choose an account and an expense category.' };
  }
  if (!input.content || Buffer.byteLength(input.content, 'utf8') > 5 * 1024 * 1024) {
    return { ok: false, message: 'Choose a non-empty statement no larger than 5 MB.' };
  }
  try {
    const job = await apiFetch<{ imported_rows: number; failed_rows: number }>(
      `/workspaces/${input.workspaceId}/import`,
      {
        method: 'POST',
        idempotencyKey: input.idempotencyKey,
        timeoutMs: 120_000,
        body: {
          format: input.format,
          filename: input.filename,
          content: input.content,
          account_id: input.accountId,
          expense_category_id: input.expenseCategoryId,
          ...(input.incomeCategoryId ? { income_category_id: input.incomeCategoryId } : {}),
          idempotency_key: input.idempotencyKey,
        },
      },
    );
    revalidatePath('/dashboard/import');
    revalidatePath('/dashboard/transactions');
    revalidatePath('/dashboard');
    return { ok: true, imported: job.imported_rows, failed: job.failed_rows };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof ApiError ? error.message : 'Import failed before any result was returned.',
    };
  }
}
