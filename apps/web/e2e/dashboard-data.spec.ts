/**
 * Dashboard renders real ledger data — DEC-011, DEC-012.
 *
 * Guards two things that are easy to regress:
 *  - the summary shows the user's ACTUAL figures, not the old mock constants
 *  - a change badge is omitted when the prior month is zero, rather than
 *    displaying a fabricated percentage
 */
import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe('dashboard on real data', () => {
  test.skip(!EMAIL || !PASSWORD, 'needs supabase + API running');

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(EMAIL!);
    await page.locator('input[type="password"]').first().fill(PASSWORD!);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    // The dashboard is a server component behind a Suspense boundary, so the
    // skeleton paints first. Waiting on the URL alone races the stream.
    await expect(page.getByText('Loading dashboard')).toBeHidden({ timeout: 20_000 });
  });

  test('summary cards show ledger figures, not the removed mock values', async ({ page }) => {
    // The seeded user's real spend: 12500+450000+89000+23000 = 574500 minor.
    await expect(page.getByText('5,745.00').first()).toBeVisible({ timeout: 15_000 });

    const body = await page.locator('body').innerText();
    // The mock constants that used to be hardcoded here.
    expect(body).not.toContain('1,25,480.00');
    expect(body).not.toContain('85,000.00');
    expect(body).not.toContain('+12.5%');
  });

  test('no fabricated change badge when the prior month is empty', async ({ page }) => {
    await expect(page.getByText('5,745.00').first()).toBeVisible({ timeout: 15_000 });
    const body = await page.locator('body').innerText();
    // With no prior-month data the delta is undefined; nothing should claim one.
    expect(body).not.toMatch(/[+-]\d+\.\d%/);
  });

  test('recent transactions come from the ledger', async ({ page }) => {
    await expect(page.getByText('Monthly Rent').first()).toBeVisible({ timeout: 15_000 });

    const body = await page.locator('body').innerText();
    // ...and not the Bangla mock payees that were hardcoded.
    expect(body).not.toContain('মুদির দোকান');
  });
});
