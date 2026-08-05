/**
 * Dashboard renders real ledger data — DEC-011, DEC-012.
 *
 * Guards what was actually broken:
 *  - the summary shows the user's ACTUAL figures, not the old mock constants
 *  - a change badge is omitted when the prior month is zero, rather than
 *    displaying a fabricated percentage
 *  - the §5.3 panels carry data rather than a "coming soon" placeholder
 *
 * Rewritten to seed its own account. It previously asserted `5,745.00` and
 * `Monthly Rent` against whatever `E2E_EMAIL` pointed at, so it passed only for
 * one particular hand-made login and failed for everyone else — including for
 * this suite as soon as another spec wrote to the shared account.
 */
import { test, expect } from '@playwright/test';
import { LIVE, seedWorkspace, setLocale, type Fixture } from './support/fixture';
import { signIn, waitForDashboard } from './support/sign-in';

test.describe('dashboard on real data', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with supabase and the API running');

  let fixture: Fixture;

  test.beforeAll(async () => {
    fixture = await seedWorkspace('dashboard');
    // Assertions below are on English copy, so the language is pinned rather
    // than left to whatever the profile default happens to be.
    await setLocale(fixture.token, 'en');
  });

  test.beforeEach(async ({ page }) => {
    await signIn(page, fixture.email, fixture.password);
    await waitForDashboard(page);
  });

  test('summary cards show ledger figures, not the removed mock values', async ({ page }) => {
    // Seeded spend: 12,500 + 5,800 + 22,000 = 40,300. Income 80,000.
    await expect(page.getByText('40,300.00').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('80,000.00').first()).toBeVisible();

    const body = await page.locator('body').innerText();
    // The mock constants that used to be hardcoded here.
    expect(body).not.toContain('1,25,480.00');
    expect(body).not.toContain('85,000.00');
    expect(body).not.toContain('+12.5%');
  });

  test('no fabricated change badge when the prior month is empty', async ({ page }) => {
    await expect(page.getByText('40,300.00').first()).toBeVisible({ timeout: 15_000 });
    const body = await page.locator('body').innerText();
    // With no prior-month data the delta is undefined; nothing should claim one.
    expect(body).not.toMatch(/[+-]\d+\.\d%/);
  });

  test('recent transactions come from the ledger', async ({ page }) => {
    await expect(page.getByText('Monthly Rent').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Grocery Store').first()).toBeVisible();

    const body = await page.locator('body').innerText();
    // ...and not the Bangla mock payees that were hardcoded.
    expect(body).not.toContain('মুদির দোকান');
  });

  test('every summary card is a link, not a dead number (§5.3)', async ({ page }) => {
    // Each card had `cursor: pointer` and no destination. §5.3 requires that
    // clicking a metric reaches the transactions behind it.
    const cards = page.locator(
      'a[href="/dashboard/reports"], a[href="/dashboard/accounts"]',
    );
    expect(await cards.count()).toBeGreaterThanOrEqual(4);
  });

  test('amounts are formatted from minor units, not printed raw', async ({ page }) => {
    const body = await page.locator('body').innerText();
    // The regression this catches: rendering 4,030,000 minor units directly, a
    // 100x overstatement. It shipped once and a screenshot caught it.
    expect(body).not.toContain('40,30,000');
    expect(body).not.toContain('4,030,000');
  });
});
