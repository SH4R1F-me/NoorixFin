import { test, expect, type Page } from '@playwright/test';
import { LIVE, seedWorkspace, setLocale, type Fixture } from './support/fixture';

let fixture: Fixture;

test.describe('first-class debt terms', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with Supabase and the API running');
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    fixture = await seedWorkspace('debts');
    await setLocale(fixture.token, 'en');
  });

  async function signIn(page: Page) {
    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(fixture.email);
    await page.locator('input[type="password"]').first().fill(fixture.password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  }

  test('terms can be attached to a liability account and edited', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/debts');
    await page.getByRole('button', { name: /add debt terms/i }).click();
    await page.locator('#debt-account').selectOption({ label: 'Car Loan' });
    await page.locator('#debt-principal').fill('250000');
    await page.locator('#debt-rate').fill('7.5');
    await page.locator('#debt-minimum').fill('12000');
    await page.locator('#debt-due-day').fill('12');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/debt terms saved/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Car Loan')).toBeVisible();
    await expect(page.getByText('7.50%')).toBeVisible();

    await page.getByRole('button', { name: /edit/i }).click();
    await page.locator('#debt-minimum').fill('15000');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/debt terms saved/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('body')).toContainText('15,000');
  });

  test('removing terms preserves the liability account and its ledger balance', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/debts');
    await page.getByRole('button', { name: /remove terms: Car Loan/i }).click();
    await expect(page.getByText(/account and its balance are unchanged/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/no repayment terms yet/i)).toBeVisible();

    await page.goto('/dashboard/accounts');
    await expect(page.getByText('Car Loan')).toBeVisible({ timeout: 15_000 });
  });
});
