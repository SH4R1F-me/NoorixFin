/**
 * The ledger can be written from the UI — the regression guard for the audit's
 * headline finding.
 *
 * Before this, `/dashboard/transactions`, `/accounts` and `/categories` each had
 * a create form whose save button had NO `onClick` and whose inputs were
 * uncontrolled. Filling the amount and clicking "Save Transaction" persisted
 * nothing; the account dropdown listed hardcoded fiction (`bKash`, `DBBL Bank`)
 * that referenced no real row. Every transaction in the system had been created
 * with curl.
 *
 * Each test asserts persistence ACROSS A RELOAD rather than a success toast —
 * the old page showed encouraging UI while writing nothing.
 */
import { test, expect, type Page } from '@playwright/test';
import { LIVE, seedWorkspace, setLocale, type Fixture } from './support/fixture';

/** Own account: every test here writes real ledger rows. */
let fixture: Fixture;

/** Unique per run so repeated runs cannot pass on a previous run's rows. */
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function signInEnglish(page: Page) {
  await page.goto('/auth/login');
  await page.getByPlaceholder('name@example.com').fill(fixture.email);
  await page.locator('input[type="password"]').first().fill(fixture.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  // The language is pinned in beforeAll rather than by clicking the toggle:
  // clicking raced the persist, so a later navigation could re-render in Bangla
  // and every English selector below would miss.
}

test.describe('ledger CRUD', () => {
  /**
   * Serial, deliberately.
   *
   * These tests all write into ONE workspace, and the transaction test asserts
   * that the account and category dropdowns hold the rows the earlier tests
   * created. Run in parallel they race each other's writes, so the dropdown
   * assertion fails intermittently for a reason that has nothing to do with the
   * product.
   */
  test.describe.configure({ mode: 'serial' });

  test.skip(!LIVE, 'needs E2E_LIVE=1 with supabase and the API running');

  test.beforeAll(async () => {
    fixture = await seedWorkspace('ledger');
    await setLocale(fixture.token, 'en');
  });

  test('an account can be created and survives a reload', async ({ page }) => {
    const name = `E2E Account ${stamp()}`;
    await signInEnglish(page);

    await page.goto('/dashboard/accounts');
    await page.getByRole('button', { name: /Add Account/i }).click();
    await page.locator('#acc-name').fill(name);
    await page.locator('#acc-subtype').selectOption('MOBILE_WALLET');
    await page.getByRole('button', { name: /^Create Account$/i }).click();

    await page.waitForTimeout(2000);
    await page.reload();
    await expect(page.locator('body')).toContainText(name, { timeout: 15_000 });
  });

  test('a category can be created and survives a reload', async ({ page }) => {
    const name = `E2E Category ${stamp()}`;
    await signInEnglish(page);

    await page.goto('/dashboard/categories');
    await page.getByRole('button', { name: /Create Category/i }).first().click();
    await page.locator('#cat-name').fill(name);
    await page.getByRole('button', { name: /^Create Category$/i }).last().click();

    await page.waitForTimeout(2000);
    await page.reload();
    await expect(page.locator('body')).toContainText(name, { timeout: 15_000 });
  });

  test('a transaction can be created, and the dropdowns hold REAL rows', async ({ page }) => {
    const payee = `E2E Payee ${stamp()}`;
    await signInEnglish(page);

    await page.goto('/dashboard/transactions');
    await page.getByRole('button', { name: /Add Transaction/i }).click();

    // The regression that made the old form unusable even in principle.
    const accountOptions = await page.locator('#tx-account option').allTextContents();
    expect(accountOptions.join('|')).not.toMatch(/bKash|DBBL Bank|Nagad/);
    expect(accountOptions.length, 'needs at least one real account').toBeGreaterThan(1);

    await page.locator('#tx-amount').fill('321.50');
    await page.locator('#tx-account').selectOption({ index: 1 });
    await page.locator('#tx-category').selectOption({ index: 1 });
    await page.locator('#tx-payee').fill(payee);
    await page.getByRole('button', { name: /Save Transaction/i }).click();

    await page.waitForTimeout(2500);
    await page.reload();
    const body = page.locator('body');
    // A production reload can briefly render the route-level loading region
    // while its server component fetches the ledger. Assert against the live
    // locator so Playwright waits for the persisted row instead of snapshotting
    // that transient shell.
    await expect(body).toContainText(payee, { timeout: 15_000 });
    // 321.50 major → 32150 minor → rendered back as 321.50, so the round trip
    // through minor units did not lose or scale the value (DEC-004).
    await expect(body).toContainText(/321[.,]50/, { timeout: 15_000 });
  });

  test('an invalid amount is refused with a message, not silently dropped', async ({ page }) => {
    await signInEnglish(page);
    await page.goto('/dashboard/transactions');
    await page.getByRole('button', { name: /Add Transaction/i }).click();

    await page.locator('#tx-account').selectOption({ index: 1 });
    await page.locator('#tx-category').selectOption({ index: 1 });
    // Amount deliberately left empty.
    await page.getByRole('button', { name: /Save Transaction/i }).click();

    await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('a transfer to the same account is refused', async ({ page }) => {
    await signInEnglish(page);
    await page.goto('/dashboard/transactions');
    await page.getByRole('button', { name: /Add Transaction/i }).click();
    // The type selector renders an icon beside the label, so match loosely.
    await page.locator('button', { hasText: /Transfer/i }).first().click();
    await page.waitForTimeout(400);

    await page.locator('#tx-amount').fill('10');
    await page.locator('#tx-account').selectOption({ index: 1 });
    // The destination list excludes the chosen source, so a same-account
    // transfer cannot even be expressed — assert the option is absent.
    const source = await page.locator('#tx-account').inputValue();
    const destinations = await page.locator('#tx-to option').evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
    expect(destinations).not.toContain(source);
  });
});
