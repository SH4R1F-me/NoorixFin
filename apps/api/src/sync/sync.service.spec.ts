import { SyncService } from './sync.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { NotificationsService } from '../notifications/notifications.service';

describe('SyncService composite cursor', () => {
  it('drains rows sharing one timestamp by stable primary key', async () => {
    const timestamp = '2026-08-21T10:00:00.000Z';
    const ids = [1, 2, 3].map(
      (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    );
    let ledgerPage = 0;
    const filters: string[] = [];

    const client = {
      from: (table: string) => {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          or: (filter: string) => {
            filters.push(filter);
            return builder;
          },
          order: () => builder,
          limit: () => {
            if (table !== 'ledger_accounts')
              return Promise.resolve({ data: [], error: null });
            ledgerPage += 1;
            const page = ledgerPage === 1 ? ids : [ids[2]];
            return Promise.resolve({
              data: page.map((id) => ({ id, updated_at: timestamp })),
              error: null,
            });
          },
        };
        return builder;
      },
    };
    const service = new SyncService(
      { getUserClient: () => client } as unknown as SupabaseService,
      {} as NotificationsService,
    );

    const first = await service.getDelta('workspace', 'token', { limit: 2 });
    expect(first.has_more).toBe(true);
    expect(first.changes.ledger_accounts).toHaveLength(2);

    const second = await service.getDelta('workspace', 'token', {
      limit: 2,
      cursor: first.cursor,
    });
    expect(second.has_more).toBe(false);
    expect(second.changes.ledger_accounts).toEqual([
      { id: ids[2], updated_at: timestamp },
    ]);
    expect(filters.some((filter) => filter.includes(`id.gt.${ids[1]}`))).toBe(
      true,
    );
  });

  it('rejects malformed opaque cursors with an actionable reset error', async () => {
    const service = new SyncService(
      { getUserClient: () => ({}) } as unknown as SupabaseService,
      {} as NotificationsService,
    );
    await expect(
      service.getDelta('workspace', 'token', { cursor: 'not-a-cursor' }),
    ).rejects.toMatchObject({ response: { code: 'SYNC_CURSOR_STALLED' } });
  });

  it('rejects cursor values that could alter the database filter', async () => {
    const cursor = Buffer.from(
      JSON.stringify({
        v: 1,
        sources: {
          ledger_accounts: {
            updated_at: '2026-08-21T10:00:00.000Z',
            key: ['00000000-0000-4000-8000-000000000001),id.gt.0'],
          },
        },
      }),
      'utf8',
    ).toString('base64url');
    const service = new SyncService(
      { getUserClient: () => ({}) } as unknown as SupabaseService,
      {} as NotificationsService,
    );

    await expect(
      service.getDelta('workspace', 'token', { cursor }),
    ).rejects.toMatchObject({ response: { code: 'SYNC_CURSOR_STALLED' } });
  });
});
