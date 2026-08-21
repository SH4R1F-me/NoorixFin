import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import type { SupabaseService } from '../supabase/supabase.service';
import type { AuditService } from '../observability/audit.service';
import type { SystemEventsService } from '../observability/system-events.service';
import { ComposeNotificationDto } from './dto/notification.dto';
import {
  NotificationsService,
  deliveryBackoffSeconds,
} from './notifications.service';

describe('notification delivery retry policy', () => {
  it('persists bounded exponential backoff intervals', () => {
    expect([1, 2, 3, 4, 5, 20].map(deliveryBackoffSeconds)).toEqual([
      30, 60, 120, 240, 480, 3600,
    ]);
  });
});

describe('NotificationsService rules', () => {
  it('emits only the highest crossed budget and goal milestone with stable dedupe keys', async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          period_start: '2026-08-01',
          lines: [
            {
              line_id: '11111111-1111-4111-8111-111111111111',
              name: 'Food',
              planned_minor: 1000,
              spent_minor: 1050,
              alert_threshold_pct: 80,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          goals: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              name: 'Emergency fund',
              target_minor: 1000,
              current_minor: 790,
            },
          ],
        },
      });
    const supabase = {
      getUserClient: () => ({ rpc }),
    } as unknown as SupabaseService;
    const service = new NotificationsService(
      supabase,
      new ConfigService(),
      { write: jest.fn() } as unknown as AuditService,
      { record: jest.fn() } as unknown as SystemEventsService,
    );
    const create = jest.spyOn(service, 'create').mockResolvedValue(null);

    await service.evaluateFinancialRules('token', 'user-id', 'workspace-id');

    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'budget',
        severity: 'WARNING',
        dedupeKey: 'budget:11111111-1111-4111-8111-111111111111:2026-08-01:100',
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'goal',
        severity: 'INFO',
        dedupeKey: 'goal:22222222-2222-4222-8222-222222222222:75',
      }),
    );
  });
});

describe('notification action URL validation', () => {
  const base = {
    audience: 'ALL',
    category: 'system',
    severity: 'INFO',
    title_en: 'Title',
    body_en: 'Body',
  };

  it('accepts app-relative links used by campaign deep links', async () => {
    const dto = plainToInstance(ComposeNotificationDto, {
      ...base,
      action_url: '/dashboard/notifications',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects protocol-relative links', async () => {
    const dto = plainToInstance(ComposeNotificationDto, {
      ...base,
      action_url: '//attacker.example',
    });
    expect(
      (await validate(dto)).some((error) => error.property === 'action_url'),
    ).toBe(true);
  });
});
