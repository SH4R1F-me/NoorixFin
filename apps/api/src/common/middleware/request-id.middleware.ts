/**
 * Request ID + trace context middleware — Blueprint §11.1, audit gap A7.
 *
 * `X-Request-ID` ties a client's complaint to one server log line, and has done
 * since the beginning. What it could not do is tie a **mobile crash** to the
 * API request that caused it: the app and the server mint unrelated ids, so the
 * two halves of one failure sit in two systems with nothing joining them.
 *
 * `traceparent` (W3C Trace Context) is that join. A client that sends one has
 * its trace id adopted; a client that does not gets a fresh one, so every
 * request is traceable either way. The header is echoed back for the same
 * reason `X-Request-ID` is — so the client can log what the server used.
 *
 * The W3C format rather than a bespoke header buys one thing that matters:
 * every tracing backend already parses it, so adopting one later is
 * configuration rather than a migration.
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import {
  childSpan,
  formatTraceparent,
  newTraceContext,
  parseTraceparent,
  type TraceContext,
} from '@noorixfin/observability';

/** Widened so handlers can read the trace without another parse. */
export interface TracedRequest extends Request {
  traceContext?: TraceContext;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: TracedRequest, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);

    // An inbound traceparent is continued as a CHILD span, not reused
    // verbatim: reusing the caller's span id would make the client's span and
    // the server's span the same node, and a trace viewer would collapse the
    // two into one with no boundary between them.
    const inbound = parseTraceparent(
      req.headers['traceparent'] as string | undefined,
    );
    const context = inbound ? childSpan(inbound) : newTraceContext();

    req.traceContext = context;
    req.headers['traceparent'] = formatTraceparent(context);
    res.setHeader('traceparent', formatTraceparent(context));

    next();
  }
}
