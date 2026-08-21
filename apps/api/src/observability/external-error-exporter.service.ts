import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  DurableHttpErrorReporter,
  setErrorReporter,
  type ErrorReport,
  type ErrorReportStore,
} from '@noorixfin/observability';

class JsonFileReportStore implements ErrorReportStore {
  constructor(private readonly path: string) {}

  async load(): Promise<ErrorReport[]> {
    try {
      const parsed = JSON.parse(await readFile(this.path, 'utf8')) as unknown;
      return Array.isArray(parsed) ? (parsed as ErrorReport[]) : [];
    } catch (error) {
      const code =
        error instanceof Error && 'code' in error ? String(error.code) : '';
      if (code === 'ENOENT') return [];
      throw error;
    }
  }

  async save(reports: ErrorReport[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(reports), {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temporary, this.path);
  }
}

@Injectable()
export class ExternalErrorExporterService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ExternalErrorExporterService.name);
  private reporter?: DurableHttpErrorReporter;
  private timer?: NodeJS.Timeout;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const endpoint = this.config.get<string>('ERROR_EXPORT_URL')?.trim();
    if (!endpoint) {
      this.logger.log(
        'External OTLP error export disabled (ERROR_EXPORT_URL is empty)',
      );
      return;
    }

    try {
      const headers = this.parseHeaders(
        this.config.get<string>('ERROR_EXPORT_HEADERS'),
      );
      const queuePath =
        this.config.get<string>('ERROR_EXPORT_QUEUE_PATH') ??
        './.data/error-export-queue.json';
      this.reporter = new DurableHttpErrorReporter({
        endpoint,
        headers,
        store: new JsonFileReportStore(queuePath),
        fetch: async (url, init) => {
          const response = await fetch(url, {
            ...init,
            signal: AbortSignal.timeout(10_000),
          });
          return { ok: response.ok, status: response.status };
        },
      });
      setErrorReporter(this.reporter);
      await this.reporter.flush();
      this.timer = setInterval(() => void this.reporter?.flush(), 30_000);
      this.timer.unref?.();
      this.logger.log(`Durable OTLP error export enabled; queue=${queuePath}`);
    } catch (error) {
      this.logger.error(
        `External error exporter configuration rejected: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.reporter?.flush();
  }

  private parseHeaders(raw?: string): Record<string, string> {
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      Object.values(parsed).some((value) => typeof value !== 'string')
    ) {
      throw new Error('ERROR_EXPORT_HEADERS must be a JSON object of strings');
    }
    return parsed as Record<string, string>;
  }
}
