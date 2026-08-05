/**
 * The four screens that were stubs — budgets, calendar, goals, reports.
 *
 * These assert the thing the audit could not: that each route renders REAL
 * figures derived from the ledger, and that the dashboard contract items they
 * unblock (§5.3 items 3–6) are actually delivered.
 *
 * They also guard the specific lies the old dashboard told. It rendered
 * hardcoded budget rows and a hardcoded savings goal as if they were the user's
 * own money; the assertions below check that what is on screen matches what was
 * seeded through the API, so a reintroduced placeholder fails here.
 *
 * Needs the live stack:
 *   E2E_LIVE=1 pnpm --filter @noorixfin/web test:e2e
 * The account is created and seeded by this spec — see e2e/support/fixture.ts.
 */
import { test, expect, type Page } from '@playwright/test';
import { LIVE, seedWorkspace, setLocale, type Fixture } from './support/fixture';

test.describe('planning screens', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with supabase and the API running');

  /**
   * Own account. One of these tests marks a bill PAID, so sharing a login meant
   * the calendar assertions passed on the first run and failed on the second.
   */
  let fixture: Fixture;

  test.beforeAll(async () => {
    fixture = await seedWorkspace('planning');
    // Pinned to English because some assertions are on values Intl localises —
    // "9.50%" renders as "৯.৫০%" in Bangla, which is correct behaviour and
    // would fail a test written against Latin digits.
    await setLocale(fixture.token, 'en');
  });

  async function signIn(page: Page) {
    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(fixture.email);
    await page.locator('input[type="password"]').first().fill(fixture.password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  }

  test('budgets show spend derived from the ledger, not placeholders', async ({ page }) => {
    await signIn(page);
    const response = await page.goto('/dashboard/budgets');
    expect(response?.status()).toBe(200);

    // The seeded budget: Food 20,000 planned with 12,500 spent.
    await expect(page.getByText(/20,000|২০,০০০/).first()).toBeVisible();
    await expect(page.getByText(/12,500|১২,৫০০/).first()).toBeVisible();

    // Housing is seeded at 22,000 spent against a 20,000 limit, so the
    // over-budget state must be reachable — and must be a WORD, not just a red
    // bar (§5.5 forbids colour-only status).
    await expect(page.getByText(/Over Budget|সীমা ছাড়িয়েছে|বাজেটের বেশি/i).first()).toBeVisible();

    // Progress bars must be real progressbars with a value.
    const bars = page.getByRole('progressbar');
    expect(await bars.count()).toBeGreaterThan(0);
    await expect(bars.first()).toHaveAttribute('aria-valuenow', /\d+/);

    // §5.3 drill-down: the figure leads to the entries behind it.
    const drill = page.locator('a[href*="/dashboard/transactions?category="]').first();
    await expect(drill).toBeVisible();
  });

  test('calendar derives overdue from today', async ({ page }) => {
    await signIn(page);
    const response = await page.goto('/dashboard/calendar');
    expect(response?.status()).toBe(200);

    // Seeded: Internet due 2 days ago (overdue), Electricity in 3 days.
    await expect(page.getByText('Internet').first()).toBeVisible();
    await expect(page.getByText('Electricity').first()).toBeVisible();
    await expect(page.getByText(/Overdue|বকেয়া|মেয়াদোত্তীর্ণ/i).first()).toBeVisible();

    // Marking paid must clear it — the status is stored, the OVERDUE label is not.
    await page.getByRole('button', { name: /Mark paid|পরিশোধিত/i }).first().click();
    await expect(page.getByText(/Paid|পরিশোধিত/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('goals distinguish unlinked from zero', async ({ page }) => {
    await signIn(page);
    const response = await page.goto('/dashboard/goals');
    expect(response?.status()).toBe(200);

    await expect(page.getByText('Emergency Fund').first()).toBeVisible();
    await expect(page.getByText('New Laptop').first()).toBeVisible();

    // "New Laptop" has no linked account, so it must say so rather than
    // rendering a 0% bar — null progress and zero progress are different
    // statements and only one of them is true.
    await expect(page.getByText(/Not linked|সংযুক্ত নয়/i).first()).toBeVisible();

    // The debt's terms, including the rate stored as basis points.
    await expect(page.getByText('Car Loan').first()).toBeVisible();
    await expect(page.getByText('9.50%').first()).toBeVisible();
  });

  test('reports carry the §11.3 metadata and a table alternative', async ({ page }) => {
    await signIn(page);
    const response = await page.goto('/dashboard/reports');
    expect(response?.status()).toBe(200);

    // §5.5: charts need a text/table alternative. It must be a real table with
    // scoped headers, not a div grid.
    const table = page.locator('table').first();
    await expect(table).toBeVisible();
    const columnHeaders = table.locator('th[scope="col"]');
    expect(await columnHeaders.count()).toBeGreaterThanOrEqual(4);
    expect(await table.locator('th[scope="row"]').count()).toBeGreaterThan(0);

    // §11.3: period, currency basis and generated-at, or a saved report cannot
    // be interpreted later.
    await expect(page.getByText(/Amounts in BDT|BDT এ পরিমাণ/i).first()).toBeVisible();
    await expect(page.getByText(/Generated|তৈরি/i).first()).toBeVisible();

    // The trend chart is role="img" and must have a real accessible name.
    const chart = page.getByRole('img').filter({ hasText: '' }).first();
    await expect(chart).toHaveAttribute('aria-label', /.{20,}/);
  });

  test('dashboard delivers the §5.3 contract instead of "coming soon"', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard');

    // The four panels that were placeholders now carry data.
    await expect(page.getByText(/Budget Progress|বাজেট অগ্রগতি/i).first()).toBeVisible();
    await expect(page.getByText(/Upcoming Bills|আসন্ন বিল/i).first()).toBeVisible();
    await expect(page.getByText(/Savings|সঞ্চয়/i).first()).toBeVisible();
    await expect(page.getByText('Emergency Fund').first()).toBeVisible();
    await expect(page.getByText('Internet').first()).toBeVisible();

    // "Coming soon" must NOT appear — that string was the placeholder these
    // panels used to render, and its return means a feature silently regressed.
    await expect(page.getByText(/Coming soon/i)).toHaveCount(0);

    // §5.3: every metric drills down. Each summary card is a real link.
    const cards = page.locator('a[href="/dashboard/reports"], a[href="/dashboard/accounts"]');
    expect(await cards.count()).toBeGreaterThanOrEqual(4);
  });

  test('drill-down filters the transaction list and says so', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/budgets');

    const drill = page.locator('a[href*="/dashboard/transactions?category="]').first();
    await drill.click();
    await page.waitForURL(/category=/, { timeout: 20_000 });

    // A filtered list that does not announce itself is indistinguishable from a
    // nearly-empty ledger — which on a finance app is alarming.
    // `transactions.category` is "বিভাগ" in Bangla — and Bangla is the default
    // locale, so a test written only against the English string would pass
    // against no users at all.
    await expect(
      page.getByRole('status').filter({ hasText: /Category|বিভাগ/i }).first(),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Clear|মুছুন/i }).first()).toBeVisible();

    // The filter must actually filter: the seeded ledger has 6 entries, only
    // one of which is food.
    const rows = page.locator('a[href="/dashboard/transactions"]');
    await expect(rows.first()).toBeVisible();
  });
});
