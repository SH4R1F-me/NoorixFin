import { expect, test } from '@playwright/test';
import { LIVE, createUser } from './support/fixture';
import { E2E_API_URL } from './support/runtime';

const API_URL = E2E_API_URL;

async function mobileCall<T>(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${API_URL}/v1${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Client-Info': 'noorixfin-mobile-e2e/1.0.0 (android; contract-smoke)',
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  if (!response.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${path} returned ${response.status}: ${await response.text()}`,
    );
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

test.describe('mobile fresh-install API contract', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with Supabase and the API running');

  test('creates and selects a workspace, loads planning/profile, updates profile, and exports', async () => {
    const { token } = await createUser('mobile-contract');
    const created = await mobileCall<{ id: string; name: string; base_currency: string }>(
      token,
      '/workspaces',
      {
        method: 'POST',
        body: { name: 'Mobile Home', base_currency: 'SAR', timezone: 'Asia/Riyadh' },
      },
    );

    const workspaces = await mobileCall<Array<{ id: string; name: string }>>(token, '/workspaces');
    expect(Array.isArray(workspaces)).toBe(true);
    expect(workspaces).toContainEqual(
      expect.objectContaining({ id: created.id, name: 'Mobile Home' }),
    );

    const [budget, goals, profile] = await Promise.all([
      mobileCall<{ visible: boolean; has_budget: boolean }>(
        token,
        `/workspaces/${created.id}/budget`,
      ),
      mobileCall<{ visible: boolean; goals: unknown[] }>(token, `/workspaces/${created.id}/goals`),
      mobileCall<{ display_name: string; base_currency: string }>(token, '/me'),
    ]);
    expect(budget).toMatchObject({ visible: true, has_budget: false });
    expect(goals.visible).toBe(true);
    expect(Array.isArray(goals.goals)).toBe(true);
    expect(profile.base_currency).toBeTruthy();

    const updated = await mobileCall<{ display_name: string }>(token, '/me/preferences', {
      method: 'PATCH',
      body: { display_name: 'Mobile User' },
    });
    expect(updated.display_name).toBe('Mobile User');

    const exported = await mobileCall<{ format_version: number; profile: unknown }>(
      token,
      '/me/export',
    );
    expect(exported.format_version).toBeGreaterThanOrEqual(1);
    expect(exported.profile).toBeTruthy();
  });
});
