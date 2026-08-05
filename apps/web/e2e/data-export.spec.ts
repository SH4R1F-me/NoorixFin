/**
 * Data export — Blueprint §15.3, acceptance DATA-01, audit item 17.
 *
 * DATA-01 is two requirements pulling against each other, and a test that only
 * checks the download succeeded proves neither:
 *
 *   COMPLETE — the ledger must actually be in the file. An export whose entries
 *   arrive without their postings is an export of empty rows, because under
 *   DEC-006 the entry carries no amount.
 *
 *   SCOPED — nothing operational, and nothing belonging to anyone else.
 *
 * ── WHY THIS DRIVES THE BROWSER RATHER THAN FETCHING THE ROUTE ───────────────
 * The first version of this spec called `page.request.get()` on the export URL
 * and failed: Playwright's API request context does not forward the httpOnly
 * session cookie, so it landed on the login redirect while the product was
 * working perfectly. Clicking the actual link is both the honest test and the
 * stronger one — it covers the `<a download>` in Settings, the route handler,
 * the API call behind it, and the browser's decision to save rather than
 * render, which is the entire point of setting Content-Disposition.
 */
import { test, expect } from '@playwright/test';
import { LIVE, seedWorkspace, setLocale, type Fixture } from './support/fixture';
import { readFileSync } from 'node:fs';

let fixture: Fixture;

test.describe('data export', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with supabase and the API running');

  test.beforeAll(async () => {
    fixture = await seedWorkspace('export');
    // The link below is matched by its English catalog string.
    await setLocale(fixture.token, 'en');
  });

  test('downloads a complete, correctly scoped copy of the ledger', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(fixture.email);
    await page.locator('input[type="password"]').first().fill(fixture.password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.goto('/dashboard/settings');

    // Two headers carry guarantees worth asserting, and a navigation the
    // browser turns into a download never surfaces as a `response` event — so
    // read them with a same-origin fetch FROM the page, which carries the same
    // httpOnly cookie and exposes every header because the origin matches.
    const meta = await page.evaluate(async () => {
      const r = await fetch('/dashboard/settings/export');
      return {
        status: r.status,
        disposition: r.headers.get('content-disposition'),
        cache: r.headers.get('cache-control'),
      };
    });
    expect(meta.status).toBe(200);
    // The browser must SAVE this, not render it.
    expect(meta.disposition).toContain('attachment');
    // One user's entire financial history must never sit in a shared cache.
    expect(meta.cache).toContain('no-store');

    // Now the real thing. That a `download` event fires AT ALL is itself the
    // strongest assertion available on Content-Disposition: without it the
    // browser renders the JSON in a tab and this line times out.
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: /download my data/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^noorixfin-export-\d{4}-\d{2}-\d{2}\.json$/);

    const path = await download.path();
    const bundle = JSON.parse(readFileSync(path, 'utf8'));

    expect(bundle.format_version).toBe(1);
    expect(bundle.workspaces).toHaveLength(1);

    const ws = bundle.workspaces[0];
    expect(ws.ledger_accounts.length).toBeGreaterThanOrEqual(3);
    expect(ws.categories.length).toBeGreaterThanOrEqual(10);
    expect(ws.journal_entries.length).toBeGreaterThanOrEqual(6);

    // The seeded salary is 80,000.00 — assert on the POSTING, since that is
    // where the money lives.
    const debits = ws.journal_postings.map((p: { debit_minor: number }) => p.debit_minor);
    expect(debits).toContain(8_000_000);

    // Planning data too: the export predates none of it.
    expect(ws.budget_lines.length).toBeGreaterThanOrEqual(3);
    expect(ws.savings_goals.length).toBeGreaterThanOrEqual(2);
    expect(ws.calendar_events.length).toBeGreaterThanOrEqual(3);

    // SCOPED. Operational logs are platform records, not user data — an audit
    // trail a user can export is one an attacker can read after taking an
    // account. Serialised without `scope`, which names them in prose.
    const data = JSON.stringify({
      profile: bundle.profile,
      memberships: bundle.memberships,
      workspaces: bundle.workspaces,
    });
    expect(data).not.toContain('system_events');
    expect(data).not.toContain('audit_events');
  });

  test('refuses without a session', async ({ page }) => {
    // No sign-in. `proxy.ts` gates /dashboard/*, so this lands on login rather
    // than returning the file — either way, no data leaves.
    await page.goto('/dashboard/settings/export');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
