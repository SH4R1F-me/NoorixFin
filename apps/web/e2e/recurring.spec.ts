/**
 * Recurring rules — audit §2.3.
 *
 * `recurring_rules` has existed since migration 00015 with a full API and no
 * screen, so a user could say "rent is due on the 1st" exactly once and then
 * had to remember to say it again every month.
 *
 * ── THE ASSERTION THAT MATTERS IS THE ONE ABOUT MONEY ───────────────────────
 * §9.4: nothing auto-posts an entry the user has not confirmed. A recurring
 * rule is the feature most likely to be MISREAD as "pay this automatically",
 * and a user who believes their rent is being paid when it is not finds out at
 * the worst possible moment. So this checks both that the wording says so and
 * that the balance does not move.
 */
import { test, expect, type Page } from '@playwright/test';
import { LIVE, seedWorkspace, setLocale, type Fixture } from './support/fixture';

let fixture: Fixture;

test.describe('recurring rules', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with supabase and the API running');
  // Serial: the delete test removes what the create test made.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    fixture = await seedWorkspace('recurring');
    await setLocale(fixture.token, 'en');
  });

  async function signIn(page: Page) {
    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(fixture.email);
    await page.locator('input[type="password"]').first().fill(fixture.password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  }

  /**
   * The transaction list, as the user-visible proof that nothing was posted.
   *
   * Asserted here rather than on a dashboard figure: the exact arithmetic is
   * pinned by the API-level checks, and what a BROWSER test can say usefully is
   * that no new row appeared where money would show up.
   */
  async function transactionPayees(page: Page): Promise<string> {
    await page.goto('/dashboard/transactions');
    const payees = page.getByTestId('tx-payee');
    // Auto-waiting on the ELEMENTS, not on whole-page text. `innerText` of the
    // body can come back empty mid-navigation, which made this comparison
    // depend on timing rather than on whether an entry had been posted.
    await expect(payees.first()).toBeVisible({ timeout: 20_000 });
    const names = await payees.allInnerTexts();
    expect(names.length, 'the seeded ledger should not be empty').toBeGreaterThan(0);
    return names.sort().join('|');
  }

  test('a rule can be created, and posts nothing', async ({ page }) => {
    await signIn(page);
    const before = await transactionPayees(page);

    await page.goto('/dashboard/recurring');
    // By id, not by name: the empty state's own heading also matches
    // /recurring rules/i, and matching both is a strict-mode failure about the
    // selector rather than about the panel.
    await expect(page.locator('#recurring-heading')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /add a recurring rule/i }).click();
    await page.locator('#rule-name').fill('Rent');
    await page.locator('#rule-amount').fill('22000');
    await page.locator('#rule-account').selectOption({ index: 1 });
    await page.locator('#rule-category').selectOption({ index: 1 });
    await page.locator('#rule-frequency').selectOption('MONTHLY');

    // The honest sentence must be on the form, not in a tooltip — this is the
    // one place a user decides what the app will do with their money.
    await expect(page.locator('#rule-behavior-note')).toContainText(/never posts/i);

    await page.getByRole('button', { name: /save rule/i }).click();
    await expect(page.getByText(/recurring rule saved/i)).toBeVisible({ timeout: 20_000 });

    // Persistence, not the success message.
    await page.reload();
    await expect(page.locator('body')).toContainText('Rent');
    await expect(page.locator('body')).toContainText('Monthly');

    // §9.4 — a rule is a template, so the ledger must be untouched. Byte
    // equality: any new entry, in either direction, changes this string.
    const after = await transactionPayees(page);
    expect(after).toBe(before);
  });

  test('the rule reads as a reminder, never as an automatic payment', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/recurring');
    await expect(page.locator('body')).toContainText('Rent', { timeout: 15_000 });

    // Wording is the feature. "Automatic payment" here would be a lie the
    // schema cannot deliver on.
    await expect(page.locator('body')).toContainText(/remind me/i);
    await expect(page.locator('body')).not.toContainText(/pays automatically/i);
    await expect(page.locator('body')).not.toContainText(/automatic payment/i);
  });

  test('a rule can be paused and resumed without deleting it', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/recurring');
    await page.getByRole('button', { name: /pause rule: Rent/i }).click();
    await expect(page.getByText(/recurring rule paused/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Paused', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /resume rule: Rent/i }).click();
    await expect(page.getByText(/recurring rule resumed/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /pause rule: Rent/i })).toBeVisible();
  });

  test('deleting a rule removes the reminder and no transaction', async ({ page }) => {
    await signIn(page);
    const transactionsBefore = await transactionPayees(page);

    await page.goto('/dashboard/recurring');
    await page.getByRole('button', { name: /delete rule: Rent/i }).click();
    await expect(page.getByText(/recurring rule deleted/i)).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByRole('button', { name: /delete rule: Rent/i })).toHaveCount(0);

    // The ledger is untouched — deleting the thing that REMINDS you about a
    // payment must never unmake a payment.
    const transactionsAfter = await transactionPayees(page);
    expect(transactionsAfter).toBe(transactionsBefore);
  });
});
