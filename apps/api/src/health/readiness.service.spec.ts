/**
 * ReadinessService — the probe an orchestrator trusts to route traffic.
 *
 * The cases below are the ones where a wrong answer costs something real: a
 * readiness that stays `true` while the database is gone sends users into
 * errors, and one that keeps answering `ready` after SIGTERM is the reason
 * requests get cut off mid-deploy.
 */
import { ReadinessService } from './readiness.service';
import type { SupabaseService } from '../supabase/supabase.service';

/** Minimal stand-in for the fluent `.from().select().limit()` chain. */
function supabaseStub(options: { dbError?: string } = {}) {
  return {
    getServiceClient: () => ({
      from: () => ({
        select: () => ({
          limit: () =>
            Promise.resolve({
              error: options.dbError ? { message: options.dbError } : null,
            }),
        }),
      }),
    }),
    getSupabaseUrl: () => 'http://supabase.test',
  } as unknown as SupabaseService;
}

describe('ReadinessService', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  const authOk = () =>
    (global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200 }) as never);

  it('reports ready when every dependency answers', async () => {
    authOk();
    const service = new ReadinessService(supabaseStub());

    const report = await service.check();

    expect(report.status).toBe('ready');
    expect(report.checks.map((c) => c.name).sort()).toEqual([
      'auth',
      'database',
    ]);
    expect(report.checks.every((c) => c.ok)).toBe(true);
  });

  it('reports not_ready when the database errors, and names the reason', async () => {
    authOk();
    const service = new ReadinessService(
      supabaseStub({ dbError: 'connection refused' }),
    );

    const report = await service.check();

    // Not merely "not ready": an operator reading this needs to know which
    // dependency failed without opening a second tool.
    expect(report.status).toBe('not_ready');
    const database = report.checks.find((c) => c.name === 'database');
    expect(database?.ok).toBe(false);
    expect(database?.error).toContain('connection refused');

    // One failing dependency must not mask the healthy ones.
    expect(report.checks.find((c) => c.name === 'auth')?.ok).toBe(true);
  });

  it('reports not_ready when auth returns a non-200', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 503 }) as never;
    const service = new ReadinessService(supabaseStub());

    const report = await service.check();

    expect(report.status).toBe('not_ready');
    expect(report.checks.find((c) => c.name === 'auth')?.error).toContain(
      '503',
    );
  });

  it('reports shutting_down after a shutdown signal, without probing', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as never;
    const service = new ReadinessService(supabaseStub());

    service.onApplicationShutdown('SIGTERM');
    const report = await service.check();

    expect(report.status).toBe('shutting_down');
    expect(service.isShuttingDown()).toBe(true);
    // Probing a dependency while draining is pointless work during the window
    // where the process is least able to spare it.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a shutdown answer is never served from the pre-shutdown cache', async () => {
    authOk();
    const service = new ReadinessService(supabaseStub());

    // Warm the cache, then shut down inside the TTL. If the cache were checked
    // first, the probe would keep saying "ready" for two more seconds — which
    // is exactly the window the drain exists to avoid.
    expect((await service.check()).status).toBe('ready');
    service.onApplicationShutdown('SIGTERM');

    expect((await service.check()).status).toBe('shutting_down');
  });

  it('caches within the TTL so polling does not become its own load', async () => {
    authOk();
    const service = new ReadinessService(supabaseStub());

    await service.check();
    await service.check();
    await service.check();

    // Three polls, one round of probes.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('logs a shutdown once even though the hook fires twice', () => {
    const service = new ReadinessService(supabaseStub());
    const log = jest
      .spyOn(service['logger'], 'log')
      .mockImplementation(() => undefined);

    // main.ts flips it before the drain; Nest's lifecycle calls it again on close.
    service.onApplicationShutdown('SIGTERM');
    service.onApplicationShutdown(undefined);

    expect(log).toHaveBeenCalledTimes(1);
  });
});
