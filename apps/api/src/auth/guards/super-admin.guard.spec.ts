/**
 * SuperAdminGuard — the API-level half of the operator gate.
 *
 * The case worth testing is the one that bit during development: a failed
 * lookup used to be reported as "you are not a super admin", which sends an
 * operator hunting through RLS policies for what is actually a missing grant or
 * an unreachable database.
 */
import {
  ExecutionContext,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';
import type { SupabaseService } from '../../supabase/supabase.service';

type ProfileRow = { is_super_admin: boolean; status: string } | null;

const DEFAULT_USER = { id: 'user-1', email: 'a@b.c' };

/**
 * `user` is not a defaulted parameter: passing `undefined` to a default would
 * silently substitute the signed-in user and make the unauthenticated test pass
 * against the wrong input.
 */
function makeContext(user: unknown): ExecutionContext {
  const request = { user, accessToken: 'token' };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeSupabase(result: { data: ProfileRow; error: unknown }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve(result),
  };
  return {
    getUserClient: () => ({ from: () => chain }),
  } as unknown as SupabaseService;
}

describe('SuperAdminGuard', () => {
  it('allows an active super admin', async () => {
    const guard = new SuperAdminGuard(
      makeSupabase({ data: { is_super_admin: true, status: 'ACTIVE' }, error: null }),
    );
    await expect(guard.canActivate(makeContext(DEFAULT_USER))).resolves.toBe(true);
  });

  it('rejects a normal user with 403', async () => {
    const guard = new SuperAdminGuard(
      makeSupabase({ data: { is_super_admin: false, status: 'ACTIVE' }, error: null }),
    );
    await expect(guard.canActivate(makeContext(DEFAULT_USER))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a SUSPENDED operator — the flag survives, the privilege does not', async () => {
    // Closes the window where a banned operator's still-valid access token
    // (up to jwt_expiry) would otherwise reach the console.
    const guard = new SuperAdminGuard(
      makeSupabase({ data: { is_super_admin: true, status: 'SUSPENDED' }, error: null }),
    );
    await expect(guard.canActivate(makeContext(DEFAULT_USER))).rejects.toMatchObject({
      response: { code: 'ACCOUNT_NOT_ACTIVE' },
    });
  });

  it('rejects an operator whose account is pending deletion', async () => {
    const guard = new SuperAdminGuard(
      makeSupabase({
        data: { is_super_admin: true, status: 'PENDING_DELETION' },
        error: null,
      }),
    );
    await expect(guard.canActivate(makeContext(DEFAULT_USER))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('reports a BROKEN LOOKUP as 503, not as "not a super admin"', async () => {
    // A missing GRANT or an unreachable database is a server fault. Reporting it
    // as an authorization failure is what makes it take an afternoon to find.
    const guard = new SuperAdminGuard(
      makeSupabase({
        data: null,
        error: { code: '42501', message: 'permission denied for table profiles' },
      }),
    );
    await expect(guard.canActivate(makeContext(DEFAULT_USER))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('treats "no profile row" (PGRST116) as a genuine 403, not a server fault', async () => {
    const guard = new SuperAdminGuard(
      makeSupabase({ data: null, error: { code: 'PGRST116', message: 'no rows' } }),
    );
    await expect(guard.canActivate(makeContext(DEFAULT_USER))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects an unauthenticated request', async () => {
    const guard = new SuperAdminGuard(
      makeSupabase({ data: { is_super_admin: true, status: 'ACTIVE' }, error: null }),
    );
    await expect(guard.canActivate(makeContext(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
