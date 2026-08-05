/**
 * Tags — audit §6.3.
 *
 * The `tags` and `journal_entry_tags` tables have existed since migration
 * 00002 and the API has accepted `tags[]` on create for just as long. Nothing
 * read or wrote them: no way to add a tag, no way to see one, no way to find
 * anything by one. The tables were, in the audit's words, support with no UI.
 *
 * ── WHAT THIS ASSERTS ───────────────────────────────────────────────────────
 * That a tag is worth having, which takes more than the input accepting text:
 * it has to persist, appear on the transaction afterwards, and actually narrow
 * the list. The last one is the point — a tag nobody can filter by is
 * decoration.
 */
import { test, expect, type Page } from '@playwright/test';
import { LIVE, seedWorkspace, setLocale, type Fixture } from './support/fixture';

let fixture: Fixture;

test.describe('tags', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with supabase and the API running');
  // Serial: later tests filter and delete the tags earlier ones create.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    fixture = await seedWorkspace('tags');
    await setLocale(fixture.token, 'en');
  });

  async function signIn(page: Page) {
    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(fixture.email);
    await page.locator('input[type="password"]').first().fill(fixture.password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  }

  async function openAddForm(page: Page) {
    await page.goto('/dashboard/transactions');
    await page.getByRole('button', { name: /add transaction/i }).first().click();
    await expect(page.locator('#tx-tags')).toBeVisible({ timeout: 15_000 });
  }

  test('a transaction can be tagged, and the tag shows on it afterwards', async ({ page }) => {
    await signIn(page);
    await openAddForm(page);

    await page.locator('input[type="number"], input[inputmode="decimal"]').first().fill('4200');
    await page.locator('#tx-payee').fill('Tagged Lunch');
    await page.locator('select').nth(0).selectOption({ index: 1 });
    await page.locator('select').nth(1).selectOption({ index: 1 });

    // Enter commits a tag without submitting the form — a tag field where
    // Enter saves the transaction would make multi-tagging impossible.
    await page.locator('#tx-tags').fill('lunch');
    await page.locator('#tx-tags').press('Enter');
    await expect(page.locator('#tx-tags')).toHaveValue('');
    await expect(page.getByText('#lunch')).toBeVisible();

    // A second tag, left UNCOMMITTED in the input. It must still be saved:
    // someone who types a tag and clicks Save means it.
    await page.locator('#tx-tags').fill('work');

    await page.getByRole('button', { name: /save transaction/i }).click();

    // Persistence is the assertion, not the absence of an error.
    await expect(page.getByText('Tagged Lunch')).toBeVisible({ timeout: 20_000 });
    await page.reload();
    const row = page.locator('div').filter({ hasText: /^Tagged Lunch/ }).first();
    await expect(row).toContainText('#lunch');
    await expect(row).toContainText('#work');
  });

  test('the tag filter narrows the list, and says that it did', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/transactions');

    // The seeded workspace has six transactions; only one is tagged.
    await expect(page.getByText('Monthly Salary')).toBeVisible({ timeout: 15_000 });

    const filter = page.getByLabel(/filter by tag/i);
    await expect(filter).toBeVisible();
    // The count is what distinguishes a live tag from a typo.
    await expect(filter).toContainText('#lunch (1)');

    // Selected by the option's VALUE, resolved from its text. `selectOption`
    // takes a literal label, and the label carries a usage count that changes
    // as other tests add data — matching on it would be a test that breaks for
    // reasons unrelated to tags.
    const lunchValue = await filter
      .locator('option')
      .filter({ hasText: '#lunch' })
      .first()
      .getAttribute('value');
    await filter.selectOption(lunchValue!);
    await page.waitForURL(/tag=/, { timeout: 15_000 });

    await expect(page.getByText('Tagged Lunch')).toBeVisible();
    // A filtered list that looks identical to an empty account is alarming on
    // a finance product — it has to say why it is short.
    await expect(page.locator('body')).toContainText('#lunch');
    await expect(page.getByText('Monthly Salary')).toHaveCount(0);
  });

  test('a tag survives a reload of the filtered URL', async ({ page }) => {
    // The filter is a real round trip, not client state — the list is
    // paginated, so filtering in the browser would only narrow the rows
    // already fetched and quietly imply there were no others.
    await signIn(page);
    await page.goto('/dashboard/transactions');
    const filter = page.getByLabel(/filter by tag/i);
    const lunchValue = await filter
      .locator('option')
      .filter({ hasText: '#lunch' })
      .first()
      .getAttribute('value');
    await filter.selectOption(lunchValue!);
    await page.waitForURL(/tag=/, { timeout: 15_000 });

    const url = page.url();
    await page.goto(url);
    await expect(page.getByText('Tagged Lunch')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Monthly Salary')).toHaveCount(0);
  });

  test('the same tag typed twice is stored once', async ({ page }) => {
    await signIn(page);
    await openAddForm(page);

    // Case-insensitive: `tags` is UNIQUE (workspace_id, name), so "Lunch" and
    // "lunch" would otherwise become two rows that read as one.
    await page.locator('#tx-tags').fill('dupe');
    await page.locator('#tx-tags').press('Enter');
    await page.locator('#tx-tags').fill('DUPE');
    await page.locator('#tx-tags').press('Enter');

    await expect(page.locator('#tx-tags')).toHaveValue('');
    // One chip, not two.
    await expect(page.getByText(/^#dupe$/i)).toHaveCount(1);
  });
});
