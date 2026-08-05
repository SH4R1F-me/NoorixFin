/**
 * Admin service — the privacy contract and the self-lockout guards.
 *
 * The single most important assertion in this file is that no admin response
 * carries a monetary field. That is DEC-002 #12 / DEC-007, and it is enforced in
 * three places (RLS, the RPC return type, this service). This suite covers the
 * service layer; ADMIN-05c and ADMIN-06 in supabase/tests/acceptance.sql cover
 * the other two.
 */
import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { AuditService } from '../observability/audit.service';
import type { SystemEventsService } from '../observability/system-events.service';

const OPERATOR = 'op-1';
const TARGET = 'user-2';

/** Rows shaped like admin_user_overview() output — counts and metadata only. */
const OVERVIEW_ROWS = [
  {
    user_id: TARGET,
    email: 'user@example.com',
    display_name: 'User',
    status: 'ACTIVE',
    is_super_admin: false,
    workspace_count: 1,
    account_count: 3,
    entry_count: 42,
    total_count: 2,
  },
  {
    user_id: OPERATOR,
    email: 'ops@example.com',
    display_name: 'Ops',
    status: 'ACTIVE',
    is_super_admin: true,
    workspace_count: 1,
    account_count: 0,
    entry_count: 0,
    total_count: 2,
  },
];

interface Harness {
  service: AdminService;
  audit: { write: jest.Mock };
  updates: Array<{ table: string; payload: Record<string, unknown> }>;
  banCalls: Array<{ id: string; attrs: Record<string, unknown> }>;
}

function makeHarness(
  options: {
    rpc?: jest.Mock;
    profile?: { is_super_admin: boolean };
    superAdminCount?: number;
  } = {},
): Harness {
  const updates: Harness['updates'] = [];
  const banCalls: Harness['banCalls'] = [];

  const rpc =
    options.rpc ??
    jest.fn().mockResolvedValue({ data: OVERVIEW_ROWS, error: null });

  const makeClient = () => ({
    rpc,
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      Object.assign(chain, {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        range: () => Promise.resolve({ data: [], error: null, count: 0 }),
        single: () =>
          Promise.resolve({
            data: options.profile ?? { is_super_admin: false },
            error: null,
          }),
        update: (payload: Record<string, unknown>) => {
          updates.push({ table, payload });
          return {
            eq: () => Promise.resolve({ error: null }),
            select: () => ({
              single: () => Promise.resolve({ data: payload, error: null }),
            }),
          };
        },
        then: undefined,
      });
      // Head-count queries resolve the builder directly.
      return new Proxy(chain, {
        get(target, prop) {
          if (prop === 'then') {
            return (resolve: (value: unknown) => void) =>
              resolve({
                data: [],
                error: null,
                count: options.superAdminCount ?? 2,
              });
          }
          return Reflect.get(target, prop);
        },
      });
    },
    auth: {
      admin: {
        updateUserById: (id: string, attrs: Record<string, unknown>) => {
          banCalls.push({ id, attrs });
          return Promise.resolve({ error: null });
        },
      },
    },
  });

  const supabase = {
    getUserClient: makeClient,
    getServiceClient: makeClient,
    getSupabaseUrl: () => 'http://localhost:54321',
  } as unknown as SupabaseService;

  const audit = { write: jest.fn().mockResolvedValue(true) };
  const systemEvents = { record: jest.fn(), pending: 0 };

  return {
    service: new AdminService(
      supabase,
      audit as unknown as AuditService,
      systemEvents as unknown as SystemEventsService,
    ),
    audit,
    updates,
    banCalls,
  };
}

describe('AdminService — privacy contract', () => {
  const FORBIDDEN_KEYS = [
    'amount',
    'amount_minor',
    'balance',
    'debit_minor',
    'credit_minor',
    'payee',
    'note',
    'memo',
  ];

  it('listUsers returns metadata and counts, and NO monetary field', async () => {
    const { service } = makeHarness();
    const page = await service.listUsers('token', {});

    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(2);

    for (const user of page.items) {
      for (const key of FORBIDDEN_KEYS) {
        expect(Object.keys(user)).not.toContain(key);
      }
      // Counts are what the console legitimately shows.
      expect(user).toHaveProperty('entry_count');
      expect(user).toHaveProperty('workspace_count');
    }
  });

  it('strips the window-function total_count from each row', async () => {
    // Left in place it looks like a per-user figure; it is the page total.
    const { service } = makeHarness();
    const page = await service.listUsers('token', {});
    expect(Object.keys(page.items[0])).not.toContain('total_count');
  });
});

describe('AdminService — user updates', () => {
  it('writes only allowlisted fields, ignoring anything else supplied', async () => {
    const { service, updates } = makeHarness();

    await service.updateUser('token', OPERATOR, TARGET, {
      display_name: 'Renamed',
      // Cast: the DTO forbids these, but the service must not rely on that
      // alone — this asserts the second, independent enforcement point.
      ...({
        is_super_admin: true,
        status: 'ACTIVE',
        entry_count: 999,
      } as object),
    });

    const profileUpdate = updates.find((u) => u.table === 'profiles');
    expect(profileUpdate?.payload).toEqual({ display_name: 'Renamed' });
    expect(profileUpdate?.payload).not.toHaveProperty('is_super_admin');
    expect(profileUpdate?.payload).not.toHaveProperty('status');
  });

  it('rejects an update with no editable fields rather than issuing an empty write', async () => {
    const { service } = makeHarness();
    await expect(
      service.updateUser('token', OPERATOR, TARGET, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('audits every profile update', async () => {
    const { service, audit } = makeHarness();
    await service.updateUser('token', OPERATOR, TARGET, { display_name: 'X' });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ADMIN_USER_UPDATED',
        actorId: OPERATOR,
      }),
    );
  });
});

describe('AdminService — lockout guards', () => {
  it('refuses to suspend your own operator account', async () => {
    const { service } = makeHarness();
    await expect(
      service.suspendUser('token', OPERATOR, OPERATOR, 'oops'),
    ).rejects.toMatchObject({ response: { code: 'CANNOT_SUSPEND_SELF' } });
  });

  it('refuses to suspend the LAST active operator', async () => {
    // Locking every administrator out is not recoverable from the UI — it needs
    // psql and the bootstrap script.
    const { service } = makeHarness({
      profile: { is_super_admin: true },
      superAdminCount: 1,
    });
    await expect(
      service.suspendUser('token', OPERATOR, TARGET, 'reason'),
    ).rejects.toMatchObject({ response: { code: 'LAST_SUPER_ADMIN' } });
  });

  it('suspends an ordinary user: bans at the auth server AND records status', async () => {
    const { service, updates, banCalls, audit } = makeHarness({
      profile: { is_super_admin: false },
    });

    await service.suspendUser('token', OPERATOR, TARGET, 'terms violation');

    // The ban is the binding enforcement; the column is the app-side record.
    expect(banCalls[0]).toMatchObject({ id: TARGET });
    expect(banCalls[0].attrs.ban_duration).not.toBe('none');
    expect(updates.find((u) => u.table === 'profiles')?.payload).toMatchObject({
      status: 'SUSPENDED',
      suspended_reason: 'terms violation',
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_USER_SUSPENDED' }),
    );
  });

  it('reinstating also cancels a pending deletion', async () => {
    // Otherwise the purge would delete the account out from under the operator
    // who just restored it.
    const { service, updates } = makeHarness();
    await service.reinstateUser('token', OPERATOR, TARGET);

    expect(updates.find((u) => u.table === 'profiles')?.payload).toMatchObject({
      status: 'ACTIVE',
      deletion_scheduled_for: null,
      deletion_requested_at: null,
    });
  });
});

describe('AdminService — error translation', () => {
  it('maps the RPC super-admin gate to 403', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'admin_user_overview requires super admin privileges',
      },
    });
    const { service } = makeHarness({ rpc });
    await expect(service.listUsers('token', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('maps a MISSING GRANT (also 42501) to 503, not to 403', async () => {
    // Both arrive as 42501. Collapsing them tells an operator who IS a super
    // admin that they are not one.
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'permission denied for table system_events',
      },
    });
    const { service } = makeHarness({ rpc });
    await expect(service.listUsers('token', {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe('AdminService — settings', () => {
  it('rejects unknown setting keys instead of silently creating them', async () => {
    const { service } = makeHarness();
    await expect(
      service.updateSettings('token', OPERATOR, {
        settings: [{ key: 'not_a_real_setting', value: { enabled: true } }],
      }),
    ).rejects.toMatchObject({ response: { code: 'UNKNOWN_SETTING' } });
  });
});
