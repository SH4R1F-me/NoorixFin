import type { ErrorReport, ErrorReporter } from './reporter';

export interface ErrorReportStore {
  load(): Promise<ErrorReport[]>;
  save(reports: ErrorReport[]): Promise<void>;
}

export type ErrorExportFetch = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{ ok: boolean; status: number }>;

export interface DurableHttpReporterOptions {
  endpoint: string;
  store: ErrorReportStore;
  fetch: ErrorExportFetch;
  headers?: Record<string, string>;
  batchSize?: number;
  maxQueued?: number;
}

type OtlpAttribute = {
  key: string;
  value: { stringValue: string };
};

function attribute(key: string, value: unknown): OtlpAttribute {
  return {
    key,
    value: {
      stringValue: typeof value === 'string' ? value : JSON.stringify(value ?? null),
    },
  };
}

/** Convert redacted reports to the OTLP/HTTP JSON logs wire shape. */
export function toOtlpLogs(reports: ErrorReport[]): Record<string, unknown> {
  const first = reports[0];
  return {
    resourceLogs: [
      {
        resource: {
          attributes: [
            attribute('service.name', first?.release.service ?? 'noorixfin'),
            attribute('service.version', first?.release.version ?? '0.0.0'),
            attribute('deployment.environment.name', first?.release.environment ?? 'unknown'),
          ],
        },
        scopeLogs: [
          {
            scope: { name: '@noorixfin/observability', version: '1' },
            logRecords: reports.map((report) => ({
              timeUnixNano: (BigInt(new Date(report.timestamp).getTime()) * 1_000_000n).toString(),
              severityText: report.level.toUpperCase(),
              body: { stringValue: report.message },
              ...(report.traceId ? { traceId: report.traceId } : {}),
              attributes: [
                attribute('error.type', report.name),
                attribute('error.fingerprint', report.fingerprint),
                attribute('error.stack', report.stack ?? ''),
                attribute('service.release', report.release.release),
                attribute('noorixfin.context', report.context),
              ],
            })),
          },
        ],
      },
    ],
  };
}

/**
 * Persist-before-send OTLP/HTTP exporter.
 *
 * `report()` remains fire-and-forget for product call sites, but every event is
 * serialized through one promise chain: save queue, attempt delivery, then
 * remove only after a 2xx. A process/device restart reloads unsent reports.
 */
export class DurableHttpErrorReporter implements ErrorReporter {
  readonly name = 'durable-otlp-http';
  private readonly queue: ErrorReport[] = [];
  private readonly ready: Promise<void>;
  private serial: Promise<void> = Promise.resolve();
  private readonly batchSize: number;
  private readonly maxQueued: number;

  constructor(private readonly options: DurableHttpReporterOptions) {
    const endpoint = new URL(options.endpoint);
    if (
      endpoint.protocol !== 'https:' &&
      endpoint.hostname !== 'localhost' &&
      endpoint.hostname !== '127.0.0.1'
    ) {
      throw new Error('Error export requires HTTPS except on localhost.');
    }
    this.batchSize = Math.min(Math.max(options.batchSize ?? 25, 1), 100);
    this.maxQueued = Math.min(Math.max(options.maxQueued ?? 1000, 1), 10_000);
    this.ready = options.store.load().then(
      (saved) => {
        this.queue.push(...saved.slice(-this.maxQueued));
      },
      () => undefined,
    );
  }

  report(report: ErrorReport): void {
    void this.schedule(async () => {
      this.queue.push(report);
      if (this.queue.length > this.maxQueued)
        this.queue.splice(0, this.queue.length - this.maxQueued);
      await this.options.store.save([...this.queue]);
      await this.flushUnsafe();
    });
  }

  flush(): Promise<void> {
    return this.schedule(() => this.flushUnsafe());
  }

  private schedule(operation: () => Promise<void>): Promise<void> {
    const run = this.serial.then(async () => {
      await this.ready;
      await operation();
    });
    this.serial = run.catch(() => undefined);
    return run;
  }

  private async flushUnsafe(): Promise<void> {
    while (this.queue.length) {
      const batch = this.queue.slice(0, this.batchSize);
      let response: { ok: boolean; status: number };
      try {
        response = await this.options.fetch(this.options.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.options.headers,
          },
          body: JSON.stringify(toOtlpLogs(batch)),
        });
      } catch {
        return;
      }
      if (!response.ok) return;
      this.queue.splice(0, batch.length);
      await this.options.store.save([...this.queue]);
    }
  }
}
