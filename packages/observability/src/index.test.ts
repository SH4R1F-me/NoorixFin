import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildReport,
  captureError,
  compositeReporter,
  fingerprint,
  formatTraceparent,
  newTraceContext,
  normaliseMessage,
  parseTraceparent,
  redact,
  redactString,
  resolveRelease,
  setErrorReporter,
  noopReporter,
  type ErrorReport,
  type ErrorReporter,
  DurableHttpErrorReporter,
  type ErrorReportStore,
} from './index';

const release = resolveRelease('api', { APP_VERSION: '1.2.3', APP_COMMIT: 'abcdef1234' });

describe('release', () => {
  it('builds a release string that changes with the build', () => {
    expect(release.release).toBe('api@1.2.3+abcdef123');
    expect(release.commit).toBe('abcdef123');
  });

  it('degrades gracefully when nothing is set', () => {
    const bare = resolveRelease('web', {});
    expect(bare.release).toBe('web@0.0.0');
    expect(bare.commit).toBeNull();
    expect(bare.environment).toBe('development');
  });

  it('reads the commit from whichever platform provided it', () => {
    expect(resolveRelease('web', { VERCEL_GIT_COMMIT_SHA: 'v'.repeat(40) }).commit).toBe(
      'vvvvvvvvv',
    );
    expect(resolveRelease('api', { GITHUB_SHA: 'g'.repeat(40) }).commit).toBe('ggggggggg');
  });
});

describe('fingerprint', () => {
  const stackIn = (file: string, line: number) =>
    `Error: boom\n    at doThing (/home/alice/proj/apps/api/src/${file}:${line}:9)\n    at next (/home/alice/proj/node_modules/express/lib/router.js:1:1)`;

  it('groups the same bug across machines and line shifts', () => {
    // Same bug, different checkout path and a line moved by an edit above it.
    const a = fingerprint({ name: 'Error', message: 'boom', stack: stackIn('tx.ts', 12) });
    const b = fingerprint({
      name: 'Error',
      message: 'boom',
      stack: stackIn('tx.ts', 88).replace('/home/alice/proj', '/srv/app'),
    });
    expect(a).toBe(b);
  });

  it('separates different bugs', () => {
    const a = fingerprint({ name: 'Error', message: 'boom', stack: stackIn('tx.ts', 12) });
    const b = fingerprint({ name: 'Error', message: 'boom', stack: stackIn('accounts.ts', 12) });
    expect(a).not.toBe(b);
  });

  it('groups occurrences that differ only by an interpolated id', () => {
    // This is the case that matters: without normalisation every occurrence is
    // its own group and the count is meaningless.
    const one = normaliseMessage('workspace 7f3a1b2c-0000-4000-a000-00000000c0de not found');
    const two = normaliseMessage('workspace 11111111-2222-4333-a444-555555555555 not found');
    expect(one).toBe(two);
  });

  it('treats the same error on different routes as different bugs', () => {
    const base = { name: 'Error', message: 'boom', stack: stackIn('tx.ts', 12) };
    expect(fingerprint({ ...base, context: 'GET /a' })).not.toBe(
      fingerprint({ ...base, context: 'GET /b' }),
    );
  });

  it('is a stable 16-character hex string', () => {
    expect(fingerprint({ message: 'x' })).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('redact', () => {
  it('removes ledger values by key', () => {
    const out = redact({
      workspace_id: 'ws-1',
      amount: '150000',
      amountMinor: 150000,
      payee: 'Dr Rahman',
      note: 'medical',
      balance: 42,
    }) as Record<string, unknown>;

    expect(out.workspace_id).toBe('ws-1'); // not sensitive — needed to debug
    for (const key of ['amount', 'amountMinor', 'payee', 'note', 'balance']) {
      expect(out[key]).toBe('[redacted]');
    }
  });

  it('removes credentials by key', () => {
    const out = redact({
      authorization: 'Bearer abc',
      service_role_key: 'x',
      apiKey: 'y',
      cookie: 'z',
    }) as Record<string, unknown>;
    expect(Object.values(out).every((v) => v === '[redacted]')).toBe(true);
  });

  it('scrubs secrets interpolated into free text', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.abcdefghijk';
    expect(redactString(`verify failed for ${jwt}`)).toBe('verify failed for <jwt>');
    expect(redactString('mail to alice@example.com')).toBe('mail to <email>');
    expect(redactString('card 4111111111111111 declined')).toBe('card <digits> declined');
    expect(redactString('key sb_secret_ABC-123')).toContain('<supabase-key>');
  });

  it('survives a cyclic object instead of hanging', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    expect(() => redact(a)).not.toThrow();
    expect(JSON.stringify(redact(a))).toContain('depth-limit');
  });

  it('keeps an Error readable but scrubbed', () => {
    const out = redact(new Error('token eyJhbGciOi.eyJzdWIi.abcdef bad')) as Record<string, string>;
    expect(out.name).toBe('Error');
    expect(out.message).toContain('<jwt>');
  });
});

describe('captureError', () => {
  let seen: ErrorReport[];

  beforeEach(() => {
    seen = [];
    const collecting: ErrorReporter = { name: 'test', report: (r) => seen.push(r) };
    setErrorReporter(collecting);
  });

  it('reports a fingerprinted, redacted, release-tagged event', () => {
    const id = captureError(new Error('failed for alice@example.com'), {
      release,
      context: 'POST /v1/transactions',
      extra: { workspace_id: 'ws-1', amount: '9999' },
    });

    expect(seen).toHaveLength(1);
    const report = seen[0]!;
    expect(report.fingerprint).toBe(id);
    expect(report.release.release).toBe('api@1.2.3+abcdef123');
    expect(report.message).toContain('<email>');
    expect(report.context.amount).toBe('[redacted]');
    expect(report.context.workspace_id).toBe('ws-1');
  });

  it('accepts a thrown non-Error without losing it', () => {
    captureError('just a string', { release });
    expect(seen[0]!.message).toBe('just a string');
  });

  it('never throws when the reporter does', () => {
    setErrorReporter({
      name: 'broken',
      report() {
        throw new Error('sink is down');
      },
    });
    // Telemetry failing must never become a product failure.
    expect(() => captureError(new Error('x'), { release })).not.toThrow();
  });

  it('keeps fanning out when one reporter throws', () => {
    const good: ErrorReport[] = [];
    setErrorReporter(
      compositeReporter([
        {
          name: 'bad',
          report() {
            throw new Error('down');
          },
        },
        { name: 'good', report: (r) => good.push(r) },
      ]),
    );
    captureError(new Error('x'), { release });
    expect(good).toHaveLength(1);
  });

  it('does nothing by default', () => {
    setErrorReporter(noopReporter);
    expect(() => captureError(new Error('x'), { release })).not.toThrow();
  });

  it('builds a report without a reporter registered', () => {
    const report = buildReport(new Error('boom'), { release, now: () => new Date(0) });
    expect(report.timestamp).toBe('1970-01-01T00:00:00.000Z');
    expect(report.level).toBe('error');
  });

  it('agrees with a direct fingerprint() call on the same inputs', () => {
    // The web error boundaries compute the id shown to the user with
    // `fingerprint()` during render (pure), and report with `captureError` in
    // an effect (side effect). If these two ever diverged, the id on screen
    // would match nothing an operator could search for — which is worse than
    // showing no id at all, because it looks actionable.
    const error = new Error('render failed');
    const context = 'root-boundary';

    const fromReport = buildReport(error, { release, context }).fingerprint;
    const direct = fingerprint({
      name: error.name,
      message: error.message,
      stack: error.stack,
      context,
    });

    expect(fromReport).toBe(direct);
  });
});

describe('durable OTLP/HTTP export', () => {
  it('persists before send and drains the same queue after restart', async () => {
    let disk: ErrorReport[] = [];
    const store: ErrorReportStore = {
      load: async () => [...disk],
      save: async (reports) => {
        disk = [...reports];
      },
    };
    const unavailable = new DurableHttpErrorReporter({
      endpoint: 'https://otel.example.test/v1/logs',
      store,
      fetch: async () => ({ ok: false, status: 503 }),
    });
    setErrorReporter(unavailable);
    captureError(new Error('failed for alice@example.com'), { release });
    await unavailable.flush();
    expect(disk).toHaveLength(1);

    let payload = '';
    const restarted = new DurableHttpErrorReporter({
      endpoint: 'https://otel.example.test/v1/logs',
      store,
      fetch: async (_url, init) => {
        payload = init.body;
        return { ok: true, status: 200 };
      },
    });
    await restarted.flush();

    expect(disk).toEqual([]);
    expect(payload).toContain('resourceLogs');
    expect(payload).toContain('error.fingerprint');
    expect(payload).toContain('failed for <email>');
    expect(payload).not.toContain('alice@example.com');
  });

  it('refuses cleartext remote collectors', () => {
    const store: ErrorReportStore = {
      load: async () => [],
      save: async () => undefined,
    };
    expect(
      () =>
        new DurableHttpErrorReporter({
          endpoint: 'http://collector.example.test/v1/logs',
          store,
          fetch: async () => ({ ok: true, status: 200 }),
        }),
    ).toThrow(/HTTPS/);
  });
});

describe('trace context', () => {
  it('round-trips a traceparent', () => {
    const context = newTraceContext();
    const parsed = parseTraceparent(formatTraceparent(context));
    expect(parsed).toEqual(context);
  });

  it('rejects malformed and all-zero ids', () => {
    expect(parseTraceparent(undefined)).toBeNull();
    expect(parseTraceparent('garbage')).toBeNull();
    expect(parseTraceparent('00-abc-def-01')).toBeNull();
    // All-zero is invalid per the spec, and is what a buggy upstream sends;
    // accepting it would merge every request in the system into one trace.
    expect(parseTraceparent(`00-${'0'.repeat(32)}-${'0'.repeat(16)}-01`)).toBeNull();
  });

  it('generates distinct ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newTraceContext().traceId));
    expect(ids.size).toBe(200);
  });
});
