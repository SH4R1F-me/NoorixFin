/**
 * W3C Trace Context — audit gap A7.
 *
 * The API already stamps an `X-Request-ID` and echoes it back, which ties a
 * client complaint to one server log line. What it cannot do is tie a *mobile
 * crash* to the API request that caused it, because the two systems mint
 * unrelated ids.
 *
 * `traceparent` is the standard answer and costs one header. Using the W3C
 * format rather than inventing one matters for exactly one reason: every
 * tracing backend worth adopting later already understands it, so adopting one
 * becomes configuration rather than a migration.
 *
 *   traceparent: 00-<32 hex trace-id>-<16 hex span-id>-<2 hex flags>
 *
 * This module is parse-and-generate only. It deliberately does not implement
 * spans, sampling or export — that is a tracing backend's job, and building a
 * half one here would be the kind of thing nobody trusts enough to read.
 */

const TRACEPARENT =
  /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export interface TraceContext {
  traceId: string;
  spanId: string;
  sampled: boolean;
}

/** Parse an inbound header. Returns null for anything malformed. */
export function parseTraceparent(header: string | undefined | null): TraceContext | null {
  if (!header) return null;
  const match = TRACEPARENT.exec(header.trim().toLowerCase());
  if (!match) return null;

  const traceId = match[1];
  const spanId = match[2];
  const flags = match[3];
  // The regex guarantees all three, but `noUncheckedIndexedAccess` cannot know
  // that, and asserting would be a lie the next edit could make true.
  if (!traceId || !spanId || !flags) return null;

  // All-zero ids are explicitly invalid in the spec, and they are what a buggy
  // upstream emits. Treating them as valid would collapse every unrelated
  // request in the system into one trace.
  if (/^0+$/.test(traceId) || /^0+$/.test(spanId)) return null;

  return { traceId, spanId, sampled: (parseInt(flags, 16) & 0x01) === 1 };
}

export function formatTraceparent(context: TraceContext): string {
  return `00-${context.traceId}-${context.spanId}-${context.sampled ? '01' : '00'}`;
}

/**
 * Start a new trace.
 *
 * `Math.random` rather than `crypto.randomUUID`: this package is consumed by
 * React Native, where `crypto` needs a polyfill, and a trace id is a
 * correlation key rather than a secret. Guessing one lets an attacker
 * correlate nothing they could not already see.
 */
export function newTraceContext(sampled = true): TraceContext {
  return { traceId: randomHex(32), spanId: randomHex(16), sampled };
}

/** A child span in the same trace — same trace id, fresh span id. */
export function childSpan(parent: TraceContext): TraceContext {
  return { ...parent, spanId: randomHex(16) };
}

function randomHex(length: number): string {
  let out = '';
  while (out.length < length) {
    out += Math.floor(Math.random() * 0x100000000)
      .toString(16)
      .padStart(8, '0');
  }
  return out.slice(0, length);
}
