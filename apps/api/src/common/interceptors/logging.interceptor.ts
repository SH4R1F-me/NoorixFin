/**
 * Request Telemetry Interceptor — DEC-018
 *
 * Feeds `system_events` from the request path so the admin monitoring page has
 * something real to show. Records only what an operator would act on:
 *
 *   - **Slow requests** (> SLOW_MS) as WARN. The signal that precedes an outage.
 *   - **Health-check transitions** are left to the health module; not here.
 *
 * 4xx and 5xx are NOT recorded here — the exception filter sees them with the
 * error attached, and recording in both places would double every failure.
 *
 * What is deliberately never recorded: request bodies, query strings, and
 * response payloads. On a finance API those carry amounts, payees and notes, and
 * an operator has no right to read them (DEC-002 #12). Route templates only.
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
// Nest's own marker for an @Sse() handler. Imported rather than hardcoded: the
// literal value is '__sse__', not 'sse', and guessing it produced an exemption
// that silently never matched — the bug this import exists to prevent.
import { SSE_METADATA } from '@nestjs/common/constants';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { SystemEventsService } from '../../observability/system-events.service';
import { TracingService } from '../../observability/tracing.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/** Above this, a request is worth an operator's attention. */
const SLOW_MS = 1000;

@Injectable()
export class RequestTelemetryInterceptor implements NestInterceptor {
  constructor(
    private readonly systemEvents: SystemEventsService,
    private readonly tracing: TracingService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    // SSE handlers are LONG-LIVED BY DESIGN, and their observable emits once per
    // frame rather than once at completion. Measuring "latency" from request
    // start on every frame produced a WARN every few seconds with a duration
    // that grew without bound — 181 bogus "slow request" entries in the first
    // few minutes of use, which is precisely the noise that buries real signal
    // in the operator's feed. Streaming endpoints are exempt.
    const isSse = this.reflector.get<boolean>(
      SSE_METADATA,
      context.getHandler(),
    );
    if (isSse) return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: AuthenticatedUser }>();
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const latency = Date.now() - started;
          const response = http.getResponse<Response>();

          // ── Trace window (audit item 15) ────────────────────────────────
          // Off by default and self-expiring — see TracingService for why this
          // is a switch rather than always-on. When open, EVERY request is
          // recorded with its X-Request-ID, which is what lets an operator
          // follow one user's request end to end instead of seeing only the
          // parts that failed.
          if (this.tracing.isActive()) {
            this.systemEvents.record({
              level: 'INFO',
              eventCode: 'REQUEST_TRACE',
              message: `${request.method} ${scrubPath(request.url)} ${response.statusCode} ${latency}ms`,
              requestId: request.headers['x-request-id'] as string | undefined,
              actorId: request.user?.id,
              route: scrubPath(request.url),
              method: request.method,
              statusCode: response.statusCode,
              latencyMs: latency,
              metadata: { traced: true },
            });
          }

          if (latency < SLOW_MS) return;

          this.systemEvents.record({
            level: 'WARN',
            eventCode: 'SLOW_REQUEST',
            message: `${request.method} ${scrubPath(request.url)} took ${latency}ms`,
            requestId: request.headers['x-request-id'] as string | undefined,
            actorId: request.user?.id,
            route: scrubPath(request.url),
            method: request.method,
            statusCode: response.statusCode,
            latencyMs: latency,
            metadata: { threshold_ms: SLOW_MS },
          });
        },
        // Errors fall through to GlobalHttpExceptionFilter, which records them
        // with the failure detail this interceptor does not have.
      }),
    );
  }
}

/**
 * Keep the path, drop the query string.
 *
 * `?search=...` on a transactions endpoint is a payee name. The operator log is
 * not a place for one user's search terms.
 */
export function scrubPath(url: string): string {
  const queryStart = url.indexOf('?');
  return queryStart === -1 ? url : url.slice(0, queryStart);
}
