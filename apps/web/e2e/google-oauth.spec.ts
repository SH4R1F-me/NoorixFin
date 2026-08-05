/**
 * Google sign-in, once credentials are configured — §6.9.
 *
 * ── WHAT THIS CAN AND CANNOT PROVE ──────────────────────────────────────────
 * The last step of OAuth is a human consenting at accounts.google.com with real
 * Google credentials. No test can do that, and one that tried would be testing
 * a Google account rather than this product.
 *
 * What IS verifiable, and is everything on this side of the boundary:
 *   - the UI offers the button when configured, and says so plainly when not
 *     (the audit's original complaint was a button that would bounce users into
 *     a provider error);
 *   - clicking it reaches Google rather than a local error;
 *   - the authorize redirect carries the right client and the right callback,
 *     which is where a misconfiguration actually shows up.
 *
 * Gated on the same flag the UI reads, so this skips rather than fails on a
 * machine without credentials.
 */
import { test, expect } from '@playwright/test';

const CONFIGURED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';

test.describe('Google sign-in', () => {
  test.skip(!CONFIGURED, 'needs NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true and provider credentials');

  test('the login page offers the button', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
    // The "not configured" copy must be gone, or the page says both things.
    await expect(page.locator('body')).not.toContainText(/not configured/i);
  });

  test('the authorize endpoint hands off to Google with the registered callback', async ({
    request,
  }) => {
    const response = await request.get(
      `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=http://localhost:3000/auth/callback`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(302);
    const location = response.headers()['location'] ?? '';

    expect(location).toContain('accounts.google.com');
    // The redirect_uri Google validates against its registration. A mismatch
    // here is the single most common OAuth misconfiguration, and it surfaces
    // as an error page at Google rather than anything this app can catch.
    expect(decodeURIComponent(location)).toContain(
      `${SUPABASE_URL}/auth/v1/callback`,
    );
    expect(location).toMatch(/client_id=[\w.-]+\.apps\.googleusercontent\.com/);
    // Where the user lands afterwards — this app's own callback route.
    expect(decodeURIComponent(location)).toContain('/auth/callback');
  });

  test('the callback route rejects a forged code instead of signing anyone in', async ({
    page,
  }) => {
    // The half of the flow that IS ours. A callback that accepted an arbitrary
    // code would be an authentication bypass.
    await page.goto('/auth/callback?code=not-a-real-authorization-code');
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});
