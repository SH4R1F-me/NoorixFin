/**
 * Request telemetry — what it must NOT record.
 *
 * The regression this guards: the SSE live-feed handler emits once per frame and
 * stays open indefinitely, so measuring latency from request start produced a
 * "slow request" WARN every few seconds with an ever-growing duration. Within
 * minutes the monitoring feed was 181 bogus entries deep — noise burying the
 * signal the feed exists to surface.
 */
import { of, lastValueFrom } from 'rxjs';
import { Get, Sse, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SSE_METADATA } from '@nestjs/common/constants';
import { RequestTelemetryInterceptor, scrubPath } from './logging.interceptor';
import type { SystemEventsService } from '../../observability/system-events.service';

/**
 * A REAL controller with a REAL @Sse() decorator, read through a REAL Reflector.
 *
 * An earlier version of this suite stubbed the reflector to return a fixed
 * boolean, which meant it passed no matter which metadata key the interceptor
 * looked up — and the interceptor was looking up the wrong one ('sse' instead of
 * '__sse__'), so the exemption never fired in production while the test stayed
 * green. Exercising the actual decorator is what makes this test able to fail.
 */
class ProbeController {
  @Sse('stream')
  streaming() {
    return of({ data: 'frame' });
  }

  @Get('normal')
  normal() {
    return 'ok';
  }
}

const REFLECTOR = new Reflector();

function makeContext(
  handler: (...args: unknown[]) => unknown,
  url = '/v1/admin/events',
): ExecutionContext {
  const request = { url, method: 'GET', headers: {}, user: { id: 'u1' } };
  const response = { statusCode: 200 };
  return {
    getType: () => 'http',
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

const SSE_HANDLER = ProbeController.prototype.streaming;
const PLAIN_HANDLER = ProbeController.prototype.normal;

const NEXT: CallHandler = { handle: () => of('payload') };

describe('RequestTelemetryInterceptor', () => {
  let record: jest.Mock;
  let systemEvents: SystemEventsService;

  beforeEach(() => {
    record = jest.fn();
    systemEvents = { record } as unknown as SystemEventsService;
    jest.useFakeTimers();
  });

  afterEach(() => jest.useRealTimers());

  it('does not record a fast request', async () => {
    const interceptor = new RequestTelemetryInterceptor(systemEvents, REFLECTOR);
    await lastValueFrom(
      interceptor.intercept(makeContext(PLAIN_HANDLER), NEXT),
    );
    expect(record).not.toHaveBeenCalled();
  });

  it('records a genuinely slow request as WARN', async () => {
    const interceptor = new RequestTelemetryInterceptor(systemEvents, REFLECTOR);
    const slow: CallHandler = {
      handle: () => {
        jest.advanceTimersByTime(2500);
        return of('payload');
      },
    };
    await lastValueFrom(
      interceptor.intercept(makeContext(PLAIN_HANDLER), slow),
    );

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'WARN', eventCode: 'SLOW_REQUEST' }),
    );
  });

  it('NEVER records an @Sse() handler, however long it stays open', async () => {
    const interceptor = new RequestTelemetryInterceptor(systemEvents, REFLECTOR);
    const streaming: CallHandler = {
      handle: () => {
        jest.advanceTimersByTime(600_000); // ten minutes of an open stream
        return of('frame-1');
      },
    };
    await lastValueFrom(
      interceptor.intercept(
        makeContext(SSE_HANDLER, '/v1/admin/events/stream'),
        streaming,
      ),
    );

    expect(record).not.toHaveBeenCalled();
  });

  it('reads the SSE marker Nest actually sets', () => {
    // Pins the assumption that broke once: the metadata key is '__sse__'.
    expect(REFLECTOR.get(SSE_METADATA, SSE_HANDLER)).toBeTruthy();
    expect(REFLECTOR.get(SSE_METADATA, PLAIN_HANDLER)).toBeFalsy();
  });
});

describe('scrubPath', () => {
  it('drops the query string', () => {
    // `?search=...` on a transactions endpoint is a payee name. The operator log
    // is not a place for one user's search terms.
    expect(scrubPath('/v1/transactions?search=Dr%20Rahman&limit=5')).toBe(
      '/v1/transactions',
    );
  });

  it('leaves a path without a query untouched', () => {
    expect(scrubPath('/v1/admin/users')).toBe('/v1/admin/users');
  });
});
