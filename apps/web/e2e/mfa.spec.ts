/**
 * Two-factor enrolment through the UI — audit item 18.
 *
 * `admin-access.spec.ts` covers ENFORCEMENT with a factor created through the
 * API, because there the factor is a precondition. This covers the path a real
 * person takes: open Settings, scan or copy the key, type a code, and have it
 * stick. The two together are what make the control real — enforcement without
 * a working enrolment flow is a lockout, and enrolment without enforcement is
 * decoration.
 */
import { test, expect, type Page } from '@playwright/test';
import { LIVE, seedWorkspace, setLocale, totpCode, type Fixture } from './support/fixture';

let fixture: Fixture;

async function signIn(page: Page) {
  await page.goto('/auth/login');
  await page.getByPlaceholder('name@example.com').fill(fixture.email);
  await page.locator('input[type="password"]').first().fill(fixture.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

test.describe('two-factor authentication', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with supabase and the API running');
  // Serial: the second test runs against the factor the first enrols. In
  // parallel they raced, and the "already enrolled" branch below passed by
  // taking the wrong path — which is a test that agrees with itself rather
  // than with the product.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    fixture = await seedWorkspace('mfa');
    await setLocale(fixture.token, 'en');
  });

  test('a user can turn it on, and it survives a reload', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/settings');

    await expect(page.locator('body')).toContainText('Two-factor authentication');
    await page.getByRole('button', { name: /set up two-factor/i }).click();

    // The QR must be an inline data URI: a remote image would be a request to
    // an external host for the enrolment secret, and would break under a strict
    // CSP.
    const qr = page.getByRole('img', { name: /QR code/i });
    await expect(qr).toBeVisible({ timeout: 15_000 });
    await expect(qr).toHaveAttribute('src', /^data:/);

    // The typed key is the accessible path (§5.5), not a fallback for a broken
    // image — assert it is actually offered.
    const secret = await page.locator('code').first().innerText();
    expect(secret.trim().length).toBeGreaterThan(15);

    // A wrong code first. Clock drift and a mistyped digit fail identically, so
    // the message has to raise the possibility the user has not thought of —
    // "invalid code" would send someone re-typing the same correct digits.
    await page.locator('#mfa-enroll-code').fill('000000');
    await page.getByRole('button', { name: /confirm and turn on/i }).click();
    await expect(page.locator('body')).toContainText(/clock/i, { timeout: 20_000 });
    // And it must NOT have turned on.
    await expect(page.locator('#security-2fa')).not.toContainText('On');

    await page.locator('#mfa-enroll-code').fill(totpCode(secret.trim()));
    await page.getByRole('button', { name: /confirm and turn on/i }).click();

    await expect(page.locator('body')).toContainText('Two-factor authentication is on', {
      timeout: 20_000,
    });

    // The assertion that matters is survival, not the success message.
    await page.reload();
    await expect(page.getByRole('button', { name: /set up two-factor/i })).toHaveCount(0);
    await expect(page.locator('#security-2fa')).toContainText('On');
  });

  test('an enrolled account is not offered enrolment again', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/settings');

    // The previous test enrolled this account, so the setup button is gone and
    // the panel reports On. That is the state a wrong code has to be tested
    // against for the STEP-UP path rather than the enrolment one.
    await expect(page.getByRole('button', { name: /set up two-factor/i })).toHaveCount(0);
    await expect(page.locator('#security-2fa')).toContainText('On');
  });
});
