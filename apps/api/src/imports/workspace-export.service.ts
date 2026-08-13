import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

type ExportEntry = {
  id: string;
  entry_type: string;
  local_date: string;
  occurred_at: string;
  payee: string | null;
  note: string | null;
  status: string;
  source: string;
  journal_postings: Array<{
    debit_minor: number;
    credit_minor: number;
    currency_code: string;
  }>;
};

@Injectable()
export class WorkspaceExportService {
  constructor(private readonly supabase: SupabaseService) {}

  async rows(workspaceId: string, accessToken: string) {
    const client = this.supabase.getUserClient(accessToken);
    const entries: ExportEntry[] = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client
        .from('journal_entries')
        .select(
          'id, entry_type, local_date, occurred_at, payee, note, status, source, journal_postings(debit_minor, credit_minor, currency_code)',
        )
        .eq('workspace_id', workspaceId)
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      entries.push(...((data ?? []) as ExportEntry[]));
      if (!data || data.length < pageSize) break;
    }
    return entries.map((entry) => {
      const postings = entry.journal_postings ?? [];
      const amount = Math.round(
        postings.reduce(
          (sum, row) => sum + row.debit_minor + row.credit_minor,
          0,
        ) / 2,
      );
      return {
        ...entry,
        amount_minor: amount,
        currency: postings[0]?.currency_code ?? '',
      };
    });
  }

  async csv(workspaceId: string, accessToken: string): Promise<string> {
    const rows = await this.rows(workspaceId, accessToken);
    const escape = (value: string | number | null | undefined) => {
      const text = String(value ?? '');
      // Quoting does not stop Excel/LibreOffice from executing a leading
      // formula marker. Prefixing user-authored cells keeps exports inert.
      const inert = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${inert.replace(/"/g, '""')}"`;
    };
    return [
      [
        'date',
        'type',
        'payee',
        'note',
        'amount_minor',
        'currency',
        'status',
        'source',
      ].join(','),
      ...rows.map((row) =>
        [
          row.local_date,
          row.entry_type,
          row.payee,
          row.note,
          row.amount_minor,
          row.currency,
          row.status,
          row.source,
        ]
          .map(escape)
          .join(','),
      ),
    ].join('\r\n');
  }

  async pdf(workspaceId: string, accessToken: string): Promise<Buffer> {
    const rows = await this.rows(workspaceId, accessToken);
    const lines = [
      'NoorixFin transaction statement',
      `Generated: ${new Date().toISOString()}`,
      `Workspace: ${workspaceId}`,
      '',
      ...rows.map(
        (row) =>
          `${row.local_date}  ${row.entry_type.padEnd(8)}  ${row.amount_minor} ${row.currency}  ${row.payee ?? ''}`,
      ),
    ];
    return this.basicPdf(lines);
  }

  private basicPdf(lines: string[]): Buffer {
    const esc = (value: string) =>
      value
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/[^\x20-\x7E]/g, '?');
    const pages: string[][] = [];
    for (let offset = 0; offset < lines.length; offset += 48)
      pages.push(lines.slice(offset, offset + 48));
    const objects: string[] = [];
    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    const pageIds = pages.map((_, index) => 4 + index * 2);
    objects.push(
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    );
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
    pages.forEach((page, index) => {
      const pageId = 4 + index * 2;
      const contentId = pageId + 1;
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
      );
      const stream = `BT /F1 9 Tf 42 750 Td 12 TL ${page.map((line, lineIndex) => `${lineIndex ? 'T* ' : ''}(${esc(line.slice(0, 95))}) Tj`).join(' ')} ET`;
      objects.push(
        `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
      );
    });
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, '0')} 00000 n `)
      .join(
        '\n',
      )}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, 'ascii');
  }
}
