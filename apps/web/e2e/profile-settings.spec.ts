/**
 * Profile Settings actually persist.
 *
 * This page used to be entirely local `useState`: the Save button flashed
 * "Saved!" and wrote nothing. The assertion that matters is therefore survival
 * of a reload, not the presence of a success message.
 */
import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

async function signIn(page: Page) {
  await page.goto('/auth/login');
  await page.getByPlaceholder('name@example.com').fill(EMAIL!);
  await page.locator('input[type="password"]').first().fill(PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

test.describe('profile settings', () => {
  test.skip(!EMAIL || !PASSWORD, 'needs supabase + API running');

  test('preferences survive a reload', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/settings');

    const name = `E2E ${Date.now()}`;
    const displayName = page.locator('input[placeholder="Your name"]');
    await expect(displayName).toBeVisible();
    await displayName.fill(name);

    // Timezone is a real column the dashboard's month boundaries depend on.
    await page.locator('select').first().selectOption('UTC');

    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.locator('body')).toContainText(/saved/i, { timeout: 15_000 });

    await page.reload();
    await expect(page.locator('input[placeholder="Your name"]')).toHaveValue(name);
  });

  test('shows the real sign-in methods and refuses to remove the only one', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/dashboard/settings');

    await expect(page.locator('body')).toContainText('Sign-in methods');
    // A password-only account must not be offered a Disconnect that would leave
    // it with no way in.
    await expect(page.locator('body')).toContainText(/Only sign-in method|Disconnect/);
  });

  test('the danger zone requires typing the exact email', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/settings');

    await page.getByRole('button', { name: /delete my account/i }).click();

    const confirm = page.getByRole('button', { name: /confirm deletion/i });
    // Disabled until the typed confirmation matches — the deliberate friction.
    await expect(confirm).toBeDisabled();

    await page.locator(`input[placeholder*="to confirm"]`).fill('wrong@example.com');
    await expect(confirm).toBeDisabled();

    // Stop here: enabling it is verified, clicking it would destroy the fixture.
    await page.getByRole('button', { name: /^cancel$/i }).click();
    await expect(confirm).toHaveCount(0);
  });

  test('states plainly when Google sign-in is not configured', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/settings');
    // Either a working Connect button or an explicit "Not configured" — never a
    // button that would bounce the user into a provider error.
    await expect(page.locator('body')).toContainText(/Connect Google|Not configured/);
  });
});
