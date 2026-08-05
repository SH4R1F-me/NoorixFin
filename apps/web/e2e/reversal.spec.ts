/**
 * Reversing a transaction — FIN-03, audit §6.4.
 *
 * The endpoint has existed, guarded and unit-tested, since the ledger was
 * built, and nothing in the UI called it — so the acceptance item "correction
 * preserves history" could not be exercised by a user at all.
 *
 * ── WHAT "PRESERVES HISTORY" ACTUALLY REQUIRES ──────────────────────────────
 * Three things, and a test that only checks the button works proves none:
 *
 *   1. the original is still there afterwards, marked rather than removed;
 *   2. a MIRROR entry appears — the correction is a new fact, not an edit;
 *   3. the balance returns to what it was, exactly once.
 *
 * (3) is the one that caught a real bug. An earlier version voided the original
 * AND posted the mirror; since every aggregation counts `status = 'POSTED'`,
 * that removed the original's effect and then added the opposite — so reversing
 * a 1,234.00 expense moved net worth to +1,234.00 instead of to zero.
 */
import { test, expect, type Page } from '@playwright/test';
import { LIVE, seedWorkspace, setLocale, type Fixture } from './support/fixture';

let fixture: Fixture;

test.describe('reversing a transaction', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with supabase and the API running');
  // Serial: these tests reverse entries from a shared seeded ledger, and in
  // parallel they would compete for the same rows.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    fixture = await seedWorkspace('reversal');
    await setLocale(fixture.token, 'en');
  });

  async function signIn(page: Page) {
    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(fixture.email);
    await page.locator('input[type="password"]').first().fill(fixture.password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  }

  test('adds a correcting entry and leaves the original on record', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/transactions');
    const rentRow = page.locator('div').filter({ hasText: /^Monthly Rent/ }).first();
    await expect(rentRow).toBeVisible({ timeout: 15_000 });

    const reverse = page.getByRole('button', { name: /Reverse: Monthly Rent/i }).first();
    await expect(reverse).toBeVisible();
    await reverse.click();

    // The confirmation must say what will happen. "Delete" would describe a
    // different, wrong operation.
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(/Nothing is deleted/i);
    await expect(dialog).toContainText('Monthly Rent');
    await expect(dialog).not.toContainText(/\bdelete this\b/i);

    await dialog.getByRole('button', { name: /Add correcting entry/i }).click();
    // Scoped by text, not by role alone: a published broadcast also renders
    // with role="status", so the bare role matches two elements and fails
    // strict mode for a reason unrelated to what is being tested.
    await expect(page.getByText(/Correcting entry added/i)).toBeVisible({
      timeout: 20_000,
    });

    // 1. the original survives, marked
    await expect(page.locator('body')).toContainText('Monthly Rent');
    await expect(page.locator('body')).toContainText('Reversed');
    // 2. the mirror exists
    await expect(page.locator('body')).toContainText('Correction');

    // 3. the mirror carries the SAME amount as what it corrects — the rent was
    //    22,000.00, so a correction of any other figure would leave the balance
    //    wrong while still looking like a reversal.
    //    (The arithmetic itself is asserted precisely against the ledger by the
    //    API-level checks; what this proves is that the UI shows the user the
    //    real mirrored figure rather than a placeholder.)
    await expect(page.locator('body')).toContainText('22,000.00');

    // And it survives a reload — the assertion that separates a real write from
    // a hopeful bit of client state.
    await page.reload();
    await expect(page.locator('body')).toContainText('Reversed');
    await expect(page.locator('body')).toContainText('Correction');
  });

  test('an already-corrected entry is not offered again', async ({ page }) => {
    // The database refuses a second reversal; the UI must not present a button
    // that is going to be refused.
    await signIn(page);
    await page.goto('/dashboard/transactions');
    await expect(page.locator('body')).toContainText('Reversed', { timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Reverse: Monthly Rent/i })).toHaveCount(0);
  });

  test('the correcting entry itself cannot be reversed', async ({ page }) => {
    // Otherwise a user can build an unbounded chain of corrections correcting
    // corrections, which is noise rather than history.
    await signIn(page);
    await page.goto('/dashboard/transactions');
    await expect(page.locator('body')).toContainText('Correction', { timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Reverse: Reversal of/i })).toHaveCount(0);
  });

  test('cancelling changes nothing', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/transactions');

    const reverse = page.getByRole('button', { name: /^Reverse:/i }).first();
    await expect(reverse).toBeVisible({ timeout: 15_000 });
    const label = await reverse.getAttribute('aria-label');

    await reverse.click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    await page.reload();
    // Still reversible — nothing was written.
    await expect(page.getByRole('button', { name: label! })).toBeVisible();
  });
});
