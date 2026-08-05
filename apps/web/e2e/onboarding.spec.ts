/**
 * First-run setup — Blueprint §5.2.
 *
 * The state machine has existed in the database since migration 00001 and was
 * completely inert: nothing read or wrote `profiles.onboarding_status`, so
 * every user sat at ACCOUNT_CREATED forever and none of the ten §5.2 steps
 * existed anywhere in the app.
 *
 * These tests assert the two things that make it a flow rather than a screen:
 * a brand-new user is taken there, and an established one never is.
 */
import { test, expect } from '@playwright/test';
import { LIVE, PASSWORD, createUser, seedWorkspace } from './support/fixture';

test.describe('onboarding (§5.2)', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with supabase and the API running');

  test('a brand-new user is taken to setup, and can complete it', async ({ page }) => {
    // No workspace, no accounts, onboarding_status = ACCOUNT_CREATED.
    const { email } = await createUser('onboarding-new');

    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(email);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.locator('form button[type="submit"]').click();

    // The dashboard redirects rather than showing four zeroes and no guidance.
    await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');

    // 1 — language. Choosing English must change the REST of the wizard, not
    // just this step: that disconnect is what DEC-021 exists to remove.
    await page.getByRole('button', { name: /English/ }).click();
    await expect(page.getByRole('button', { name: /^Next$/ })).toBeVisible();
    await page.getByRole('button', { name: /^Next$/ }).click();

    // 2 — preferences.
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2', {
      timeout: 15_000,
    });
    await page.locator('#ob-currency').selectOption('BDT');
    await page.locator('#ob-tz').selectOption('Asia/Dhaka');
    await page.getByRole('button', { name: /^Next$/ }).click();

    // 3 — persona.
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3', {
      timeout: 15_000,
    });
    await page.getByRole('button', { name: /Freelancer/ }).click();
    await page.getByRole('button', { name: /^Next$/ }).click();

    // 4 — first account with an opening balance.
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4', {
      timeout: 15_000,
    });
    await page.locator('#ob-acc-name').fill('Wallet');
    await page.locator('#ob-opening').fill('5000');
    await page.getByRole('button', { name: /Finish setup/i }).click();

    await page.waitForURL(/\/dashboard$/, { timeout: 30_000 });

    // The opening balance posted a BALANCED entry, so it shows up as net worth
    // rather than as a number stored on the account.
    await expect(page.getByText('5,000.00').first()).toBeVisible({ timeout: 20_000 });

    // And the flow does not reappear.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('an established user is never redirected into setup', async ({ page }) => {
    // Has a workspace and accounts, but `onboarding_status` is still the
    // untouched ACCOUNT_CREATED — which describes every user who existed before
    // this flow shipped. Gating on the status alone would drag them all in.
    const fixture = await seedWorkspace('onboarding-existing');

    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(fixture.email);
    await page.locator('input[type="password"]').first().fill(fixture.password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page).not.toHaveURL(/onboarding/);
  });

  test('skipping finishes the flow instead of deferring it', async ({ page }) => {
    const { email } = await createUser('onboarding-skip');

    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(email);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/onboarding/, { timeout: 30_000 });

    await page.getByRole('button', { name: /Skip for now|আপাতত বাদ/i }).click();
    await page.waitForURL(/\/dashboard$/, { timeout: 30_000 });

    // A wizard that returns every time you decline it is a nag. The dashboard's
    // own empty states guide someone who skipped.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
