/**
 * System events service — telemetry must never break the thing it observes.
 *
 * The properties tested here are the ones that matter under load, which is
 * exactly when nobody is watching: the buffer must stay bounded, `record()` must
 * never throw, and a database outage must not turn into a retry storm.
 */
import { SystemEventsService } from './system-events.service';
import type { SupabaseService } from '../supabase/supabase.service';

/** One flushed batch of rows, as handed to `.insert()`. */
type Batch = Array<Record<string, unknown>>;

/** Typed accessor for a captured batch — keeps the assertions off `any`. */
function batchAt(insert: jest.Mock, call = 0): Batch {
  const calls = insert.mock.calls as unknown as Batch[][];
  return calls[call][0];
}

function makeSupabase(insert: jest.Mock) {
  return {
    getServiceClient: () => ({ from: () => ({ insert }) }),
  } as unknown as SupabaseService;
}

describe('SystemEventsService', () => {
  let insert: jest.Mock;
  let service: SystemEventsService;

  beforeEach(() => {
    insert = jest.fn().mockResolvedValue({ error: null });
    service = new SystemEventsService(makeSupabase(insert));
  });

  it('buffers events and writes them as ONE batch, not one insert per event', async () => {
    for (let i = 0; i < 25; i++) {
      service.record({
        level: 'ERROR',
        eventCode: 'BOOM',
        message: `err ${i}`,
      });
    }
    expect(service.pending).toBe(25);
    // Nothing written yet — the whole point is that recording is not a round trip.
    expect(insert).not.toHaveBeenCalled();

    await service.flush();

    expect(insert).toHaveBeenCalledTimes(1);
    expect(batchAt(insert)).toHaveLength(25);
    expect(service.pending).toBe(0);
  });

  it('stays bounded under a storm, dropping OLDEST and reporting the loss', async () => {
    // 700 events against a 500-row ceiling.
    for (let i = 0; i < 700; i++) {
      service.record({ level: 'ERROR', eventCode: 'STORM', message: `${i}` });
    }

    // Memory did not grow past the cap.
    expect(service.pending).toBe(500);

    await service.flush();
    const batch = batchAt(insert);

    // The NEWEST events survived — during an incident those are the useful ones.
    expect(batch.some((row) => row.message === '699')).toBe(true);
    expect(batch.some((row) => row.message === '0')).toBe(false);

    // Silent truncation would read as "nothing else happened". It must say so.
    const overflow = batch.find(
      (row) => row.event_code === 'TELEMETRY_BUFFER_OVERFLOW',
    );
    expect(overflow).toBeDefined();
    expect((overflow!.metadata as { dropped: number }).dropped).toBe(200);
  });

  it('never throws from record(), even if the client blows up', () => {
    const exploding = {
      getServiceClient: () => {
        throw new Error('no service key');
      },
    } as unknown as SupabaseService;
    const fragile = new SystemEventsService(exploding);

    // record() must be safe to call from a request path unconditionally.
    expect(() =>
      fragile.record({ level: 'FATAL', eventCode: 'X' }),
    ).not.toThrow();
  });

  it('drops a failed batch instead of retrying it into a storm', async () => {
    insert.mockResolvedValue({ error: { message: 'connection refused' } });
    service.record({ level: 'ERROR', eventCode: 'A' });

    await service.flush();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(service.pending).toBe(0);

    // Second flush has nothing to send — the failed batch was not re-queued.
    await service.flush();
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('disables persistence permanently when no service key is configured', async () => {
    const noKey = {
      getServiceClient: () => {
        throw new Error('Service client not available');
      },
    } as unknown as SupabaseService;
    const disabled = new SystemEventsService(noKey);

    disabled.record({ level: 'ERROR', eventCode: 'A' });
    await disabled.flush();

    // Further records are discarded rather than accumulating in an array that
    // will never be drained.
    disabled.record({ level: 'ERROR', eventCode: 'B' });
    expect(disabled.pending).toBe(0);
  });

  it('truncates oversized messages so one event cannot dominate a batch', async () => {
    service.record({
      level: 'ERROR',
      eventCode: 'LONG',
      message: 'x'.repeat(9000),
    });
    await service.flush();

    const row = batchAt(insert)[0] as { message: string };
    expect(row.message.length).toBeLessThanOrEqual(2000);
  });

  it('records nulls rather than undefined for absent optional fields', async () => {
    service.record({ level: 'INFO', eventCode: 'MINIMAL' });
    await service.flush();

    const row = batchAt(insert)[0];
    // PostgREST rejects undefined; every optional column must be an explicit null.
    for (const key of [
      'request_id',
      'actor_id',
      'route',
      'method',
      'status_code',
      'latency_ms',
    ]) {
      expect(row[key]).toBeNull();
    }
    expect(row.source).toBe('api');
    expect(row.metadata).toEqual({});
  });
});
