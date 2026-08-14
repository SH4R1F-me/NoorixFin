import { expect, test } from '@playwright/test';
import { evaluateSiteSettingsAuthorization } from '../src/app/admin/site-settings/authorization';

const activeOperator = {
  authenticated: true,
  isSuperAdmin: true,
  status: 'ACTIVE' as const,
  aal2: true,
};

test.describe('site settings mutation authorization', () => {
  test('rejects an anonymous caller', () => {
    expect(
      evaluateSiteSettingsAuthorization({
        authenticated: false,
        isSuperAdmin: false,
        status: null,
        aal2: false,
      }),
    ).toEqual({ allowed: false, error: 'Authentication required.' });
  });

  test('rejects a normal authenticated user', () => {
    expect(
      evaluateSiteSettingsAuthorization({
        ...activeOperator,
        isSuperAdmin: false,
      }).allowed,
    ).toBe(false);
  });

  for (const status of ['SUSPENDED', 'PENDING_DELETION'] as const) {
    test(`rejects a ${status} operator`, () => {
      expect(evaluateSiteSettingsAuthorization({ ...activeOperator, status }).allowed).toBe(false);
    });
  }

  test('rejects an AAL1 operator session', () => {
    expect(evaluateSiteSettingsAuthorization({ ...activeOperator, aal2: false })).toEqual({
      allowed: false,
      error: 'A verified second factor is required.',
    });
  });

  test('allows only an active AAL2 super administrator', () => {
    expect(evaluateSiteSettingsAuthorization(activeOperator)).toEqual({ allowed: true });
  });
});
