import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { getCurrency } from '@noorixfin/money';
import { SupabaseService } from '../supabase/supabase.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateImportDto } from './dto/import.dto';

type ParsedRow = {
  date: string;
  /** Signed major-unit decimal from the statement. Never represented as a float. */
  amount: string;
  payee: string;
  note: string;
  raw: Record<string, string>;
};

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly transactions: TransactionsService,
  ) {}

  async list(workspaceId: string, userId: string, accessToken: string) {
    const { data, error } = await this.supabase
      .getUserClient(accessToken)
      .from('import_jobs')
      .select(
        'id, format, filename, status, total_rows, imported_rows, failed_rows, error_message, created_at, completed_at',
      )
      .eq('workspace_id', workspaceId)
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  }

  async get(
    workspaceId: string,
    jobId: string,
    userId: string,
    accessToken: string,
  ) {
    const client = this.supabase.getUserClient(accessToken);
    const { data: job } = await client
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('workspace_id', workspaceId)
      .eq('created_by', userId)
      .maybeSingle();
    if (!job)
      throw new NotFoundException({
        code: 'IMPORT_NOT_FOUND',
        message: 'Import job not found',
      });
    const { data: rows } = await client
      .from('import_rows')
      .select(
        'id, row_number, normalized_payload, status, error_message, journal_entry_id',
      )
      .eq('job_id', jobId)
      .order('row_number')
      .limit(500);
    return { ...job, rows: rows ?? [] };
  }

  async create(
    workspaceId: string,
    userId: string,
    accessToken: string,
    dto: CreateImportDto,
  ) {
    if (Buffer.byteLength(dto.content, 'utf8') > 5 * 1024 * 1024) {
      throw new BadRequestException({
        code: 'IMPORT_PARSE_FAILED',
        message: 'Statement must be no larger than 5 MB',
      });
    }
    const client = this.supabase.getUserClient(accessToken);
    const { data: existing } = await client
      .from('import_jobs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('created_by', userId)
      .eq('idempotency_key', dto.idempotency_key)
      .maybeSingle();
    if (existing) return existing;

    const { data: account } = await client
      .from('ledger_accounts')
      .select('id, currency_code')
      .eq('id', dto.account_id)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!account)
      throw new BadRequestException({
        code: 'INVALID_REFERENCE',
        message: 'Import account is not available',
      });

    const { data: job, error: jobError } = await client
      .from('import_jobs')
      .insert({
        workspace_id: workspaceId,
        created_by: userId,
        idempotency_key: dto.idempotency_key,
        format: dto.format,
        filename: dto.filename,
        status: 'PROCESSING',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (jobError?.code === '23505') {
      const { data: racedJob } = await client
        .from('import_jobs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('created_by', userId)
        .eq('idempotency_key', dto.idempotency_key)
        .maybeSingle();
      if (racedJob) return racedJob;
    }
    if (jobError || !job)
      throw new BadRequestException({
        code: 'IMPORT_CREATE_FAILED',
        message: jobError?.message ?? 'Could not create import job',
      });

    let parsed: ParsedRow[];
    try {
      parsed = this.parse(dto.format, dto.content);
      if (parsed.length === 0)
        throw new Error('No transaction rows were found');
      if (parsed.length > 5000)
        throw new Error('An import may contain at most 5,000 rows');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not parse file';
      await client
        .from('import_jobs')
        .update({
          status: 'FAILED',
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      throw new BadRequestException({ code: 'IMPORT_PARSE_FAILED', message });
    }

    const staged = parsed.map((row, index) => ({
      job_id: job.id,
      workspace_id: workspaceId,
      row_number: index + 1,
      raw_payload: row.raw,
      normalized_payload: {
        date: row.date,
        amount: row.amount,
        payee: row.payee,
        note: row.note,
      },
    }));
    for (let offset = 0; offset < staged.length; offset += 500) {
      const { error } = await client
        .from('import_rows')
        .insert(staged.slice(offset, offset + 500));
      if (error) {
        await client
          .from('import_jobs')
          .update({
            status: 'FAILED',
            error_message: error.message.slice(0, 500),
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        throw new BadRequestException({
          code: 'IMPORT_STAGE_FAILED',
          message: error.message,
        });
      }
    }
    await client
      .from('import_jobs')
      .update({ total_rows: parsed.length })
      .eq('id', job.id);

    let imported = 0;
    let failed = 0;
    for (let index = 0; index < parsed.length; index += 1) {
      const row = parsed[index];
      try {
        const type = row.amount.startsWith('-') ? 'EXPENSE' : 'INCOME';
        const categoryId =
          type === 'INCOME' ? dto.income_category_id : dto.expense_category_id;
        if (!categoryId)
          throw new Error(
            type === 'INCOME'
              ? 'No income category was selected for a positive row'
              : 'No expense category was selected for a negative row',
          );
        const minor = this.decimalToMinor(row.amount, account.currency_code);
        if (!Number.isSafeInteger(minor) || minor <= 0)
          throw new Error('Amount is not a positive representable value');
        const created = await this.transactions.createTransaction(
          workspaceId,
          userId,
          accessToken,
          {
            type,
            amount: String(minor),
            account_id: dto.account_id,
            category_id: categoryId,
            occurred_at: row.date,
            payee: row.payee.slice(0, 200),
            note: row.note.slice(0, 500),
            idempotency_key: this.rowKey(job.id, index + 1),
          },
          { source: 'IMPORT', evaluateNotifications: false },
        );
        await client
          .from('import_rows')
          .update({ status: 'IMPORTED', journal_entry_id: created.id })
          .eq('job_id', job.id)
          .eq('row_number', index + 1);
        imported += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Row failed';
        this.logger.warn(`Import ${job.id} row ${index + 1}: ${message}`);
        await client
          .from('import_rows')
          .update({ status: 'FAILED', error_message: message.slice(0, 500) })
          .eq('job_id', job.id)
          .eq('row_number', index + 1);
        failed += 1;
      }
    }

    const status =
      failed === 0
        ? 'COMPLETED'
        : imported > 0
          ? 'COMPLETED_WITH_ERRORS'
          : 'FAILED';
    const { data: completed } = await client
      .from('import_jobs')
      .update({
        status,
        imported_rows: imported,
        failed_rows: failed,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .select()
      .single();
    return completed;
  }

  private rowKey(jobId: string, row: number): string {
    const hex = createHash('sha256')
      .update(`${jobId}:${row}`)
      .digest('hex')
      .slice(0, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
  }

  private parse(
    format: CreateImportDto['format'],
    content: string,
  ): ParsedRow[] {
    if (format === 'CSV') return this.parseCsv(content);
    if (format === 'OFX') return this.parseOfx(content);
    return this.parseQif(content);
  }

  private parseCsv(content: string): ParsedRow[] {
    const records = this.csvRecords(content.replace(/^\uFEFF/, ''));
    if (records.length < 2) return [];
    const headers = records[0].map((value) =>
      value.trim().toLowerCase().replace(/\s+/g, '_'),
    );
    const dateIndex = headers.findIndex((header) =>
      ['date', 'transaction_date', 'occurred_at'].includes(header),
    );
    const amountIndex = headers.findIndex((header) =>
      ['amount', 'value'].includes(header),
    );
    if (dateIndex < 0 || amountIndex < 0)
      throw new Error('CSV needs date and amount columns');
    const payeeIndex = headers.findIndex((header) =>
      ['payee', 'description', 'merchant', 'name'].includes(header),
    );
    const noteIndex = headers.findIndex((header) =>
      ['note', 'memo', 'details'].includes(header),
    );
    return records
      .slice(1)
      .filter((record) => record.some(Boolean))
      .map((record) => {
        const raw = Object.fromEntries(
          headers.map((header, index) => [header, record[index] ?? '']),
        );
        return this.normalized(
          record[dateIndex],
          record[amountIndex],
          payeeIndex >= 0 ? record[payeeIndex] : '',
          noteIndex >= 0 ? record[noteIndex] : '',
          raw,
        );
      });
  }

  private csvRecords(content: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < content.length; i += 1) {
      const char = content[i];
      if (char === '"' && quoted && content[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) {
        row.push(field);
        field = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && content[i + 1] === '\n') i += 1;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else field += char;
    }
    if (field || row.length) {
      row.push(field);
      rows.push(row);
    }
    if (quoted) throw new Error('CSV contains an unterminated quoted field');
    return rows;
  }

  private parseOfx(content: string): ParsedRow[] {
    const blocks =
      content.match(
        /<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|<\/STMTTRN>)/gi,
      ) ?? [];
    return blocks.map((block) => {
      const value = (tag: string) =>
        block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'))?.[1]?.trim() ??
        '';
      return this.normalized(
        value('DTPOSTED').slice(0, 8),
        value('TRNAMT'),
        value('NAME'),
        value('MEMO'),
        { ofx: block.slice(0, 2000) },
      );
    });
  }

  private parseQif(content: string): ParsedRow[] {
    return content
      .split(/^\^\s*$/m)
      .map((block) => {
        const fields: Record<string, string> = {};
        for (const line of block.split(/\r?\n/))
          if (line.length > 1 && !line.startsWith('!'))
            fields[line[0]] = line.slice(1).trim();
        return fields.D && fields.T
          ? this.normalized(
              fields.D,
              fields.T,
              fields.P ?? '',
              fields.M ?? '',
              fields,
            )
          : null;
      })
      .filter((row): row is ParsedRow => row !== null);
  }

  private normalized(
    dateValue: string,
    amountValue: string,
    payee: string,
    note: string,
    raw: Record<string, string>,
  ): ParsedRow {
    const cleanedAmount = amountValue.replace(/[,\s]/g, '');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleanedAmount))
      throw new Error(`Invalid amount: ${amountValue}`);
    const negative = cleanedAmount.startsWith('-');
    const unsigned = cleanedAmount.replace(/^[+-]/, '');
    const [whole = '0', fraction = ''] = unsigned.split('.');
    if (!/[1-9]/.test(`${whole}${fraction}`))
      throw new Error(`Invalid amount: ${amountValue}`);
    const amount = `${negative ? '-' : ''}${whole || '0'}${fraction ? `.${fraction}` : ''}`;
    let isoDate: string;
    if (/^\d{8}/.test(dateValue))
      isoDate = `${dateValue.slice(0, 4)}-${dateValue.slice(4, 6)}-${dateValue.slice(6, 8)}`;
    else if (/^\d{4}-\d{2}-\d{2}/.test(dateValue))
      isoDate = dateValue.slice(0, 10);
    else {
      const parts = dateValue.split(/[/'-]/).map(Number);
      if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part)))
        throw new Error(`Invalid date: ${dateValue}`);
      const year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
      isoDate = `${year}-${String(parts[0]).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}`;
    }
    const timestamp = `${isoDate}T12:00:00.000Z`;
    const parsedDate = new Date(timestamp);
    // Date.parse normalises impossible calendar dates (for example February
    // 31) instead of rejecting them. Round-tripping the UTC date keeps those
    // malformed statement rows out of the ledger.
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== isoDate
    )
      throw new Error(`Invalid date: ${dateValue}`);
    return {
      date: timestamp,
      amount,
      payee: payee || 'Imported transaction',
      note,
      raw,
    };
  }

  /** Convert a statement decimal to integer minor units without IEEE-754 money arithmetic. */
  private decimalToMinor(amount: string, currencyCode: string): number {
    const currency = getCurrency(currencyCode);
    const unsigned = amount.replace(/^[+-]/, '');
    const [whole, fraction = ''] = unsigned.split('.');
    const excess = fraction.slice(currency.exponent);
    if (/[1-9]/.test(excess))
      throw new Error(
        `Amount has more than ${currency.exponent} decimal places for ${currencyCode}`,
      );
    const fractionalMinor = fraction
      .slice(0, currency.exponent)
      .padEnd(currency.exponent, '0');
    const multiplier = 10n ** BigInt(currency.exponent);
    const absolute =
      BigInt(whole) * multiplier + BigInt(fractionalMinor || '0');
    if (absolute > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error('Amount exceeds the safe integer range');
    return Number(absolute);
  }
}
