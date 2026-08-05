/**
 * IdempotencyInterceptor — the four outcomes.
 *
 * The live checks prove the headline property (five concurrent identical
 * submissions create one broadcast), but they cannot reliably produce the
 * in-flight collision: whether the second request arrives before the first has
 * stored its response is a race, and it went the other way every time it was
 * run. That branch is the one where a mistake is worst — returning a stored
 * `null` body as though it were the answer would report success for a request
 * still in progress — so it is pinned here, where the state is chosen rather
 * than raced for.
 */
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import type { SupabaseService } from '../../supabase/supabase.service';

/** Named to avoid shadowing TypeScript's built-in `Record`. */
type StoredRecord = {
  response_status: number | null;
  response_body: unknown;
  request_fingerprint: string | null;
};

type RequestHeaders = { [key: string]: string | undefined };

/**
 * A Supabase double that records what was written.
 *
 * `insertError` is what the table would say; `existing` is what a follow-up
 * select would find. Together they express every state the real table can be
 * in when a key collides.
 */
function makeSupabase(options: {
  insertError?: { code: string; message: string };
  existing?: StoredRecord | null;
}) {
  const calls = { inserted: 0, updated: [] as unknown[], deleted: 0 };

  const builder = {
    insert: () => {
      calls.inserted += 1;
      return Promise.resolve({ error: options.insertError ?? null });
    },
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve({ data: options.existing ?? null }),
    update: (values: unknown) => {
      calls.updated.push(values);
      return { eq: () => Promise.resolve({ error: null }) };
    },
    delete: () => {
      calls.deleted += 1;
      return { eq: () => Promise.resolve({ error: null }) };
    },
  };

  return {
    service: {
      getUserClient: () => ({ from: () => builder }),
    } as unknown as SupabaseService,
    calls,
  };
}

function makeContext(headers: RequestHeaders = {}) {
  const request = {
    method: 'POST',
    path: '/admin/broadcasts',
    route: { path: '/admin/broadcasts' },
    params: {},
    query: {},
    body: { title_en: 'Maintenance' },
    user: { id: 'operator-1', email: 'op@example.com' },
    accessToken: 'token',
    headers,
  };
  return {
    getType: () => 'http',
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const handlerReturning = (value: unknown): CallHandler => ({
  handle: () => of(value),
});

function makeReflector(options: unknown) {
  return { getAllAndOverride: () => options } as unknown as Reflector;
}

const KEY = { 'idempotency-key': 'key-abc' };

describe('IdempotencyInterceptor', () => {
  it('runs the handler and stores the response on a first call', async () => {
    const { service, calls } = makeSupabase({});
    const interceptor = new IdempotencyInterceptor(service, makeReflector({}));

    const result = await lastValueFrom(
      interceptor.intercept(makeContext(KEY), handlerReturning({ id: 'b1' })),
    );

    expect(result).toEqual({ id: 'b1' });
    expect(calls.inserted).toBe(1);
    // Awaited separately: the store is fire-and-forget so the response is not
    // delayed by it.
    await new Promise((resolve) => setImmediate(resolve));
    expect(calls.updated).toEqual([
      { response_status: 200, response_body: { id: 'b1' } },
    ]);
  });

  it('replays the stored response without running the handler', async () => {
    const { service } = makeSupabase({
      insertError: { code: '23505', message: 'duplicate key' },
      existing: {
        response_status: 200,
        response_body: { id: 'b1' },
        // Matches what makeContext produces for this body.
        request_fingerprint: null,
      },
    });
    const interceptor = new IdempotencyInterceptor(service, makeReflector({}));

    const handler: CallHandler = {
      handle: () => {
        throw new Error('the handler must not run on a replay');
      },
    };

    await expect(
      lastValueFrom(interceptor.intercept(makeContext(KEY), handler)),
    ).resolves.toEqual({ id: 'b1' });
  });

  it('refuses a key reused for a different payload', async () => {
    const { service } = makeSupabase({
      insertError: { code: '23505', message: 'duplicate key' },
      existing: {
        response_status: 200,
        response_body: { id: 'b1' },
        request_fingerprint: 'a-fingerprint-from-some-other-request',
      },
    });
    const interceptor = new IdempotencyInterceptor(service, makeReflector({}));

    // 422, not the earlier response: handing back a 200 for a change that never
    // happened is the one outcome worse than no idempotency at all.
    await expect(
      lastValueFrom(
        interceptor.intercept(makeContext(KEY), handlerReturning({ id: 'b2' })),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('reports 409 while an identical request is still in flight', async () => {
    const { service } = makeSupabase({
      insertError: { code: '23505', message: 'duplicate key' },
      // Reserved, no outcome yet. The dangerous alternative would be treating
      // this null body as the answer.
      existing: {
        response_status: null,
        response_body: null,
        request_fingerprint: null,
      },
    });
    const interceptor = new IdempotencyInterceptor(service, makeReflector({}));

    await expect(
      lastValueFrom(
        interceptor.intercept(makeContext(KEY), handlerReturning({ id: 'b1' })),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('releases the key when the handler fails, so a retry is a real retry', async () => {
    const { service, calls } = makeSupabase({});
    const interceptor = new IdempotencyInterceptor(service, makeReflector({}));

    const handler: CallHandler = {
      handle: () => throwError(() => new Error('database blip')),
    };

    await expect(
      lastValueFrom(interceptor.intercept(makeContext(KEY), handler)),
    ).rejects.toThrow('database blip');

    await new Promise((resolve) => setImmediate(resolve));
    expect(calls.deleted).toBe(1);
    expect(calls.updated).toEqual([]);
  });

  // Synchronous: the refusal happens before any I/O, which is the point —
  // nothing is reserved for a request that was never going to run.
  it('demands a key when the route creates something', () => {
    const { service, calls } = makeSupabase({});
    const interceptor = new IdempotencyInterceptor(
      service,
      makeReflector({ required: true }),
    );

    expect(() =>
      interceptor.intercept(makeContext({}), handlerReturning({ id: 'b1' })),
    ).toThrow(/Idempotency-Key/);
    expect(calls.inserted).toBe(0);
  });

  it('lets a keyless request through when the route only honours a key', async () => {
    const { service, calls } = makeSupabase({});
    const interceptor = new IdempotencyInterceptor(service, makeReflector({}));

    await expect(
      lastValueFrom(
        interceptor.intercept(makeContext({}), handlerReturning({ ok: true })),
      ),
    ).resolves.toEqual({ ok: true });
    expect(calls.inserted).toBe(0);
  });

  it('ignores routes with no @Idempotent() at all', async () => {
    const { service, calls } = makeSupabase({});
    const interceptor = new IdempotencyInterceptor(
      service,
      makeReflector(undefined),
    );

    await expect(
      lastValueFrom(
        interceptor.intercept(makeContext(KEY), handlerReturning({ ok: true })),
      ),
    ).resolves.toEqual({ ok: true });
    expect(calls.inserted).toBe(0);
  });

  it('proceeds without protection rather than failing closed on a table error', async () => {
    // An operator must not be locked out of suspending an account because the
    // idempotency table is unhealthy. The risk it guards against is a
    // duplicate; the risk of failing closed is being unable to act at all.
    const { service } = makeSupabase({
      insertError: { code: '42501', message: 'permission denied' },
    });
    const interceptor = new IdempotencyInterceptor(service, makeReflector({}));

    await expect(
      lastValueFrom(
        interceptor.intercept(makeContext(KEY), handlerReturning({ id: 'b1' })),
      ),
    ).resolves.toEqual({ id: 'b1' });
  });
});
