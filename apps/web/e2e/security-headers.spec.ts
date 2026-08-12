/**
 * Security headers — regression guard (audit gap S1).
 *
 * Before this, the web app shipped with no CSP, no HSTS, and no clickjacking
 * protection at all: `next.config.ts` contained a single turbopack setting.
 *
 * The assertions below are ordered by how quietly each one fails. A missing
 * `X-Frame-Options` is visible to any scanner. A CSP whose nonce never reaches
 * the script tags is not: the header looks perfect in curl, and the site is
 * simply dead in the browser — which is exactly the failure this file exists
 * to catch, because it depends on Next reading the policy off the REQUEST
 * headers, a detail no header dump can show you.
 */
import { test, expect } from '@playwright/test';

/** A public route: these must hold before anyone signs in. */
const PUBLIC_PATH = '/auth/login';

test('every static security header is present', async ({ request }) => {
  const response = await request.get(PUBLIC_PATH);
  expect(response.status()).toBe(200);

  const headers = response.headers();

  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['cross-origin-resource-policy']).toBe('same-origin');

  // Powerful features this app never uses. Asserting a few rather than the
  // whole string, so adding a directive does not break the test.
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['permissions-policy']).toContain('geolocation=()');
  expect(headers['permissions-policy']).toContain('microphone=()');

  // The framework and its version are not something to advertise.
  expect(headers['x-powered-by']).toBeUndefined();
});

test('HSTS is sent by the production server', async ({ request }) => {
  // Playwright runs against `next start`, so NODE_ENV is production here and
  // the production-only branch of next.config.ts applies.
  const headers = (await request.get(PUBLIC_PATH)).headers();
  expect(headers['strict-transport-security']).toContain('max-age=31536000');
  expect(headers['strict-transport-security']).toContain('includeSubDomains');

  // `preload` is intentionally absent — it is close to irreversible and binds
  // every future subdomain. If someone adds it, that should be a decision.
  expect(headers['strict-transport-security']).not.toContain('preload');
});

test('the CSP locks down the directives that matter', async ({ request }) => {
  const csp = (await request.get(PUBLIC_PATH)).headers()['content-security-policy'];
  expect(csp, 'no CSP header at all').toBeTruthy();

  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain("form-action 'self'");
  expect(csp).toContain("frame-ancestors 'none'");

  // The whole point of the nonce: scripts are trusted by nonce, never by being
  // inline. If `'unsafe-inline'` ever appears in script-src, the policy stops
  // being a defence against XSS and becomes decoration.
  expect(csp).toMatch(/script-src [^;]*'nonce-[a-f0-9]{32}'/);
  expect(csp).not.toMatch(/script-src [^;]*'unsafe-inline'/);
});

test('the nonce is unique per request', async ({ request }) => {
  const nonceOf = async () => {
    const csp = (await request.get(PUBLIC_PATH)).headers()['content-security-policy'];
    return csp.match(/'nonce-([a-f0-9]+)'/)?.[1];
  };

  const [first, second] = [await nonceOf(), await nonceOf()];
  expect(first).toBeTruthy();
  // A nonce reused across requests is guessable, which defeats it entirely.
  expect(first).not.toBe(second);
});

test('the nonce in the header is the one on the script tags', async ({ request }) => {
  // This is the assertion that catches a broken wiring. Next injects the nonce
  // by parsing the CSP off the request headers that proxy.ts forwards inward;
  // set the header only on the response and every script is blocked while the
  // header still looks correct from outside.
  const response = await request.get(PUBLIC_PATH);
  const csp = response.headers()['content-security-policy'];
  const headerNonce = csp.match(/'nonce-([a-f0-9]+)'/)?.[1];
  expect(headerNonce).toBeTruthy();

  const html = await response.text();
  expect(html, 'no script carried a nonce').toContain(`nonce="${headerNonce}"`);
});

test('a real page load produces no CSP violations', async ({ page }) => {
  // Blocked resources surface as console errors, not as failed navigations, so
  // a page can look fine to `goto()` and be inert to a user.
  const violations: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Content Security Policy|Refused to (load|execute|apply)/i.test(text)) {
      violations.push(text);
    }
  });

  await page.goto(PUBLIC_PATH);
  await page.waitForLoadState('networkidle');

  // Proves the page is hydrated rather than merely server-rendered: if
  // 'strict-dynamic' broke chunk loading, the markup would still be here and
  // nothing would work.
  await expect(page.getByPlaceholder('name@example.com')).toBeVisible();

  expect(violations, `CSP blocked something:\n${violations.join('\n')}`).toHaveLength(0);
});
