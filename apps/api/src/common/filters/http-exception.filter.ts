/**
 * Global HTTP Exception Filter — Blueprint §11.1
 * Returns consistent error format with request ID.
 * Never leaks sensitive financial data in error responses.
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  captureError,
  fingerprint,
  resolveRelease,
} from '@noorixfin/observability';
import { SystemEventsService } from '../../observability/system-events.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { scrubPath } from '../interceptors/logging.interceptor';
import type { TracedRequest } from '../middleware/request-id.middleware';

/**
 * Resolved once at module load, not per request: the build cannot change while
 * the process is running, and doing this per error would read the environment
 * thousands of times during exactly the incident where it is busiest.
 */
const RELEASE = resolveRelease('api');

interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
  timestamp: string;
  path: string;
  fieldErrors?: Record<string, string[]>;
}

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  constructor(private readonly systemEvents: SystemEventsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { user?: AuthenticatedUser }>();

    // Typed as `number`, not inferred as HttpStatus: it is reassigned from
    // exception.getStatus(), which returns a plain number, and the comparisons
    // below (`status >= 500`) are numeric rather than enum-membership checks.
    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let fieldErrors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        const obj = exResponse as Record<string, unknown>;
        message = (obj.message as string) || message;
        code = (obj.code as string) || this.statusToCode(status);

        // Handle class-validator errors
        if (Array.isArray(obj.message)) {
          message = 'Validation failed';
          fieldErrors = this.parseValidationErrors(obj.message as string[]);
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Ensure code is set from status if not already
    if (
      code === 'INTERNAL_ERROR' &&
      status !== Number(HttpStatus.INTERNAL_SERVER_ERROR)
    ) {
      code = this.statusToCode(status);
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      code,
      message,
      requestId: (request.headers['x-request-id'] as string) || 'unknown',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (fieldErrors) {
      errorResponse.fieldErrors = fieldErrors;
    }

    // Log error without sensitive financial data
    this.logger.error(
      `[${errorResponse.requestId}] ${request.method} ${request.url} → ${status}`,
      status >= 500 && exception instanceof Error ? exception.stack : undefined,
    );

    this.recordSystemEvent(status, code, message, request, exception);

    response.status(status).json(errorResponse);
  }

  /**
   * Feed the operator's monitoring log (DEC-018).
   *
   * 5xx is ERROR — the system misbehaved. 401/403/429 are WARN — they are the
   * shape of a credential-stuffing or scraping attempt and an operator wants to
   * see the pattern. Ordinary 400/404/409 are NOT recorded: they are a client
   * using the API wrongly, they are the bulk of all failures, and logging them
   * would bury the signal in noise (and spend the free-tier row budget on it).
   *
   * Never recorded: request bodies and query strings. On this API they carry
   * amounts, payees and notes, which an operator has no right to (DEC-002 #12).
   */
  private recordSystemEvent(
    status: number,
    code: string,
    message: string,
    request: TracedRequest & { user?: AuthenticatedUser },
    exception: unknown,
  ): void {
    const isServerError = status >= 500;
    const isSecuritySignal = [401, 403, 429].includes(status);
    if (!isServerError && !isSecuritySignal) return;

    const route = scrubPath(request.url);
    const traceId = request.traceContext?.traceId;

    // Grouping key (audit gap R1). One bug firing ten thousand times used to
    // read as ten thousand unrelated problems and bury the other nine; with a
    // fingerprint an operator can ask how many DISTINCT things are broken:
    //
    //   SELECT metadata->>'fingerprint', count(*)
    //   FROM system_events WHERE level = 'ERROR' GROUP BY 1 ORDER BY 2 DESC;
    //
    // The route is part of the identity, so the same generic failure on two
    // endpoints stays two entries rather than one misleading total.
    const group = fingerprint({
      name: exception instanceof Error ? exception.name : 'Error',
      message,
      stack: exception instanceof Error ? exception.stack : undefined,
      context: `${request.method} ${route}`,
    });

    this.systemEvents.record({
      level: isServerError ? 'ERROR' : 'WARN',
      eventCode: code,
      message,
      requestId: request.headers['x-request-id'] as string | undefined,
      actorId: request.user?.id,
      route,
      method: request.method,
      statusCode: status,
      metadata: {
        fingerprint: group,
        // Which build. Without it, "errors spiked at 14:00" cannot be joined
        // to "we deployed at 13:58" — the first question anyone asks.
        release: RELEASE.release,
        environment: RELEASE.environment,
        // Joins this server-side failure to the client span that caused it.
        trace_id: traceId,
        // A stack is the whole point of a 5xx entry; it is our own code, not
        // user data. Bounded so one exception cannot dominate a batch.
        stack:
          isServerError && exception instanceof Error
            ? exception.stack?.slice(0, 4000)
            : undefined,
      },
    });

    // Hand the same failure to whatever external reporter is registered. The
    // default is a no-op, so this costs one function call and changes nothing
    // until someone configures one — see @noorixfin/observability.
    if (isServerError) {
      captureError(exception, {
        release: RELEASE,
        traceId,
        context: `${request.method} ${route}`,
        extra: {
          code,
          status,
          request_id: request.headers['x-request-id'],
          actor_id: request.user?.id,
        },
      });
    }
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMITED',
    };
    return map[status] || 'ERROR';
  }

  private parseValidationErrors(messages: string[]): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    for (const msg of messages) {
      // class-validator format: "property — constraint message"
      const parts = msg.split(' ');
      const field = parts[0] || 'general';
      if (!errors[field]) {
        errors[field] = [];
      }
      errors[field].push(msg);
    }
    return errors;
  }
}
