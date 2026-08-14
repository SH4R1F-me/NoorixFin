/**
 * Per-spec test accounts.
 *
 * ── WHY EACH SPEC NEEDS ITS OWN USER ─────────────────────────────────────────
 * The suite used to share one account through `E2E_EMAIL`. That was survivable
 * while the app stored nothing, but two features since then made it actively
 * broken:
 *
 *   - the language choice now PERSISTS to `profiles.locale`, so the i18n spec
 *     flipping to English changed what every other spec rendered — and with
 *     `fullyParallel: true` the flip landed mid-run;
 *   - the calendar spec marks a bill paid, and the ledger specs write entries,
 *     so "the seeded figures" drifted every time the suite ran.
 *
 * Both showed up as failures that looked like product bugs and were not. So a
 * spec that needs data creates its own account and seeds it through the real
 * API — which also means the fixture is built by the same endpoints the product
 * uses, and a broken endpoint fails here rather than producing a quietly wrong
 * fixture.
 *
 * Requires Supabase and the API to be running. Callers `test.skip()` when
 * `E2E_LIVE` is not set.
 */
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { E2E_API_URL } from './runtime';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const API_URL = E2E_API_URL;
const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/** Set when the live stack is available. Every data-dependent spec gates on it. */
export const LIVE = process.env.E2E_LIVE === '1';

export const PASSWORD = 'E2E-Password-1234';

export interface Fixture {
  email: string;
  password: string;
  workspaceId: string;
  token: string;
  /** Category ids by translation key, for drill-down assertions. */
  categories: Record<string, string>;
  accounts: Record<string, string>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function api<T>(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  // ── Backing off on 429 ────────────────────────────────────────────────────
  // Seeding a workspace is ~15 writes, and Playwright runs spec files in
  // parallel, so several seeds together burst past the API's global throttle
  // (10 req/s — see ThrottlerModule in app.module.ts). Without this the suite
  // failed with RATE_LIMITED in `beforeAll`, which reads like a product bug and
  // is not one: the throttle is working.
  //
  // Retrying rather than raising the limit for tests: a client that gets a 429
  // and gives up is the wrong client, and the fixture should behave like the
  // real one.
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${API_URL}/v1${path}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });

    if (response.status === 429 && attempt < 6) {
      await sleep(400 * 2 ** attempt);
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `${init.method ?? 'GET'} ${path} → ${response.status} ${await response.text()}`,
      );
    }
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }
}

/**
 * Create an account and sign in.
 *
 * `label` becomes part of the address so a leftover row in a local database can
 * be traced back to the spec that made it.
 */
export async function createUser(label: string): Promise<{ email: string; token: string }> {
  const email = `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@noorixfin.test`;

  await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const { access_token } = (await response.json()) as { access_token?: string };
  if (!access_token) throw new Error(`could not sign in as ${email}`);

  return { email, token: access_token };
}

/**
 * A workspace with known figures.
 *
 * The amounts are chosen so every assertion in the suite has an unambiguous
 * target: housing is deliberately OVER its limit, transport is deliberately
 * inside its alert threshold, and one goal is deliberately left unlinked so the
 * null-vs-zero distinction can be asserted.
 */
export async function seedWorkspace(label: string): Promise<Fixture> {
  const { email, token } = await createUser(label);

  const workspace = await api<{ id: string }>(token, '/workspaces', {
    method: 'POST',
    body: { name: 'Personal', base_currency: 'BDT', timezone: 'Asia/Dhaka' },
  });

  // Listing seeds the system catalogue as a side effect.
  const categoryRows = await api<{ id: string; translation_key: string | null }[]>(
    token,
    `/workspaces/${workspace.id}/categories`,
  );
  const categories: Record<string, string> = {};
  for (const row of categoryRows) {
    if (row.translation_key) categories[row.translation_key] = row.id;
  }

  const accounts: Record<string, string> = {};
  for (const [name, cls, subtype] of [
    ['Cash', 'ASSET', 'CASH'],
    ['Savings', 'ASSET', 'SAVINGS'],
    ['Car Loan', 'LIABILITY', 'LOAN'],
  ] as const) {
    const created = await api<{ id: string }>(token, `/workspaces/${workspace.id}/accounts`, {
      method: 'POST',
      body: { name, class: cls, subtype, currency_code: 'BDT' },
    });
    accounts[name] = created.id;
  }

  const tx = (body: Record<string, unknown>) =>
    api(token, `/workspaces/${workspace.id}/transactions`, {
      method: 'POST',
      body: { ...body, idempotency_key: crypto.randomUUID() },
    });

  await tx({
    type: 'INCOME',
    amount: '8000000',
    account_id: accounts.Cash,
    category_id: categories['cat.salary'],
    payee: 'Monthly Salary',
  });
  await tx({
    type: 'EXPENSE',
    amount: '1250000',
    account_id: accounts.Cash,
    category_id: categories['cat.food_dining'],
    payee: 'Grocery Store',
  });
  await tx({
    type: 'EXPENSE',
    amount: '580000',
    account_id: accounts.Cash,
    category_id: categories['cat.transport'],
    payee: 'Ride Share',
  });
  // Over its 20,000 limit on purpose — the over-budget state needs a subject.
  await tx({
    type: 'EXPENSE',
    amount: '2200000',
    account_id: accounts.Cash,
    category_id: categories['cat.housing'],
    payee: 'Monthly Rent',
  });
  await tx({
    type: 'TRANSFER',
    amount: '1500000',
    account_id: accounts.Cash,
    transfer_to_account_id: accounts.Savings,
  });
  await tx({
    type: 'TRANSFER',
    amount: '30000000',
    account_id: accounts['Car Loan'],
    transfer_to_account_id: accounts.Cash,
  });

  await api(token, `/workspaces/${workspace.id}/budget`, {
    method: 'PUT',
    body: {
      name: 'Monthly',
      lines: [
        { category_id: categories['cat.food_dining'], planned_minor: '2000000' },
        { category_id: categories['cat.transport'], planned_minor: '600000' },
        { category_id: categories['cat.housing'], planned_minor: '2000000' },
      ],
    },
  });

  await api(token, `/workspaces/${workspace.id}/goals`, {
    method: 'POST',
    body: {
      name: 'Emergency Fund',
      target_minor: '10000000',
      linked_account_id: accounts.Savings,
      target_date: '2027-06-01',
    },
  });
  // No linked account: the UI must say "not linked" rather than "0% saved".
  await api(token, `/workspaces/${workspace.id}/goals`, {
    method: 'POST',
    body: { name: 'New Laptop', target_minor: '15000000' },
  });

  await api(token, `/workspaces/${workspace.id}/debts`, {
    method: 'PUT',
    body: {
      ledger_account_id: accounts['Car Loan'],
      principal_minor: '30000000',
      annual_rate_bps: 950,
      minimum_payment_minor: '250000',
      due_day: 5,
    },
  });

  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

  await api(token, `/workspaces/${workspace.id}/calendar`, {
    method: 'POST',
    body: { type: 'BILL', title: 'Electricity', amount_minor: '120000', due_date: day(3) },
  });
  // Dated in the past so OVERDUE — which is derived, not stored — has a subject.
  await api(token, `/workspaces/${workspace.id}/calendar`, {
    method: 'POST',
    body: { type: 'BILL', title: 'Internet', amount_minor: '80000', due_date: day(-2) },
  });
  await api(token, `/workspaces/${workspace.id}/calendar`, {
    method: 'POST',
    body: {
      type: 'INCOME',
      title: 'Freelance payment',
      amount_minor: '4500000',
      due_date: day(7),
    },
  });

  return { email, password: PASSWORD, workspaceId: workspace.id, token, categories, accounts };
}

/**
 * Force a locale before the browser ever renders.
 *
 * Writes `profiles.locale` directly rather than clicking the toggle: the
 * profile is the source of truth and beats the cookie (DEC-021), so a spec that
 * only set the cookie would be overridden by whatever the profile happened to
 * say. Specs that assert on English copy call this with 'en'.
 */
export async function setLocale(token: string, locale: 'bn' | 'en'): Promise<void> {
  await api(token, '/me/preferences', { method: 'PATCH', body: { locale } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Operators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A super admin with a verified TOTP factor.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * The admin specs used to gate on `E2E_ADMIN_EMAIL`, which nobody sets, so the
 * ACCESS-CONTROL suite — the one asserting that a normal user cannot reach the
 * console and that an operator cannot see another user's money — skipped
 * silently on every CI run. A security test that does not run is worse than one
 * that does not exist, because the green tick is read as coverage.
 *
 * Promotion goes through psql because there is deliberately no API for it:
 * DEC-019 made `is_super_admin` unwritable through column grants precisely so
 * that becoming an operator cannot be done by anything holding a user token.
 * The fixture has to use the same door the real bootstrap uses.
 */
export interface Operator extends Fixture {
  /** Base32 TOTP secret, so a spec can generate a live code. */
  totpSecret: string;
}

/** RFC 6238. Six digits, 30-second step — no dependency needed for that. */
export function totpCode(base32Secret: string, when = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of base32Secret.replace(/=+$/, '').toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  }
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(when / 1000 / 30)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000)
    .toString()
    .padStart(6, '0');
}

export async function createOperator(label: string): Promise<Operator> {
  const fixture = await seedWorkspace(`admin-${label}`);

  execFileSync(
    'psql',
    [
      DB_URL,
      '-v',
      'ON_ERROR_STOP=1',
      '-tAc',
      // Parameterised by email, which the fixture generated — no interpolation
      // of anything a test author types.
      `UPDATE public.profiles SET is_super_admin = TRUE WHERE id = (SELECT id FROM auth.users WHERE email = '${fixture.email}');`,
    ],
    { stdio: 'pipe' },
  );

  // Enrol a factor through GoTrue directly. The UI path is covered by its own
  // spec; here the factor is a precondition, not the thing under test.
  const authCall = async (path: string, body?: unknown) => {
    const response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${fixture.token}`,
        'Content-Type': 'application/json',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      throw new Error(`${path} → ${response.status} ${await response.text()}`);
    }
    return response.json() as Promise<Record<string, never>>;
  };

  const enrolled = (await authCall('/factors', {
    factor_type: 'totp',
    friendly_name: 'E2E',
  })) as unknown as { id: string; totp: { secret: string } };

  const challenge = (await authCall(
    `/factors/${enrolled.id}/challenge`,
    {},
  )) as unknown as { id: string };

  await authCall(`/factors/${enrolled.id}/verify`, {
    challenge_id: challenge.id,
    code: totpCode(enrolled.totp.secret),
  });

  return { ...fixture, totpSecret: enrolled.totp.secret };
}
