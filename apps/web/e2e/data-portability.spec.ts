import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { LIVE, seedWorkspace, setLocale, type Fixture } from './support/fixture';
import { signIn } from './support/sign-in';

let fixture: Fixture;

test.describe('statement portability and private receipts', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with Supabase and the API running');

  test.beforeAll(async () => {
    fixture = await seedWorkspace('portability');
    await setLocale(fixture.token, 'en');
  });

  test('imports a staged CSV, exports it, and manages a private receipt', async ({ page }) => {
    await signIn(page, fixture.email, fixture.password);
    await page.goto('/dashboard/import');

    await page.getByLabel('Statement file').setInputFiles({
      name: 'phase-five.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'date,amount,payee,note\n2026-08-13,-12.50,Phase Five Market,groceries\n2026-08-12,25.00,Phase Five Rebate,refund',
      ),
    });
    await page.getByLabel('Account').selectOption(fixture.accounts.Cash);
    await page.getByLabel('Expense category').selectOption(fixture.categories['cat.food_dining']);
    await page
      .getByLabel('Income category (positive rows)')
      .selectOption(fixture.categories['cat.salary']);
    await page.getByRole('button', { name: 'Stage and import' }).click();

    await expect(page.getByRole('status')).toContainText('Imported 2 rows', { timeout: 30_000 });
    await expect(page.getByText('phase-five.csv')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'CSV' }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(download.suggestedFilename()).toMatch(/^noorixfin-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(readFileSync(downloadPath, 'utf8')).toContain('Phase Five Market');

    await page.goto('/dashboard/transactions');
    await expect(page.getByText('Phase Five Market')).toBeVisible();

    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Attach receipt to Phase Five Market' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'phase-five-receipt.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%%EOF', 'ascii'),
    });

    await expect(page.getByRole('status')).toContainText('Receipt attached', { timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'phase-five-receipt.pdf' })).toBeVisible();

    const receiptResponse = await page.evaluate(async () => {
      const link = document.querySelector<HTMLAnchorElement>('a[href*="/api/attachments/"]');
      if (!link) return { status: 0, type: null };
      const response = await fetch(link.href);
      return { status: response.status, type: response.headers.get('content-type') };
    });
    expect(receiptResponse.status).toBe(200);
    expect(receiptResponse.type).toContain('application/pdf');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete receipt phase-five-receipt.pdf' }).click();
    await expect(page.getByRole('status')).toContainText('Receipt deleted');
    await expect(page.getByRole('link', { name: 'phase-five-receipt.pdf' })).toHaveCount(0);

    // The API keeps ordinary JSON at 100 KB. These payloads prove the two
    // explicitly large routes reach their controllers instead of dying in the
    // parser before validation or receipt idempotency can run.
    const headers = {
      Authorization: `Bearer ${fixture.token}`,
      'Content-Type': 'application/json',
    };
    const largeImport = await page.request.post(
      `http://127.0.0.1:3001/v1/workspaces/${fixture.workspaceId}/import`,
      {
        headers,
        data: {
          format: 'CSV',
          filename: 'large-invalid.csv',
          content: 'x'.repeat(128 * 1024),
          account_id: fixture.accounts.Cash,
          expense_category_id: fixture.categories['cat.food_dining'],
          idempotency_key: crypto.randomUUID(),
        },
      },
    );
    expect(largeImport.status()).toBe(400);
    expect((await largeImport.json()).code).toBe('IMPORT_PARSE_FAILED');

    const transactionPage = await page.request.get(
      `http://127.0.0.1:3001/v1/workspaces/${fixture.workspaceId}/transactions?limit=1`,
      { headers },
    );
    const transactionId = ((await transactionPage.json()) as { items: Array<{ id: string }> })
      .items[0].id;
    const receiptKey = crypto.randomUUID();
    const largeReceipt = {
      idempotency_key: receiptKey,
      filename: 'large-receipt.pdf',
      content_type: 'application/pdf',
      data_base64: Buffer.concat([
        Buffer.from('%PDF-1.4\n', 'ascii'),
        Buffer.alloc(128 * 1024),
      ]).toString('base64'),
    };
    const receiptEndpoint = `http://127.0.0.1:3001/v1/workspaces/${fixture.workspaceId}/transactions/${transactionId}/attachments`;
    const firstLargeReceipt = await page.request.post(receiptEndpoint, {
      headers,
      data: largeReceipt,
    });
    expect(firstLargeReceipt.status()).toBe(201);
    const firstAttachment = (await firstLargeReceipt.json()) as { id: string };
    const replayedLargeReceipt = await page.request.post(receiptEndpoint, {
      headers,
      data: largeReceipt,
    });
    expect((await replayedLargeReceipt.json()).id).toBe(firstAttachment.id);
    const cleanup = await page.request.delete(`${receiptEndpoint}/${firstAttachment.id}`, {
      headers,
    });
    expect(cleanup.ok()).toBe(true);
  });
});
