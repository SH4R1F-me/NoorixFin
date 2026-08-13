import { WorkspaceExportService } from './workspace-export.service';

describe('WorkspaceExportService', () => {
  const service = new WorkspaceExportService({} as never);

  it('quotes spreadsheet fields and neutralises embedded CSV quotes', async () => {
    jest.spyOn(service, 'rows').mockResolvedValue([
      {
        id: 'entry',
        entry_type: 'EXPENSE',
        local_date: '2026-08-13',
        occurred_at: '2026-08-13T12:00:00.000Z',
        payee: 'Market, "Central"',
        note: '=2+2',
        status: 'POSTED',
        source: 'MANUAL',
        journal_postings: [],
        amount_minor: 1250,
        currency: 'SAR',
      },
    ]);

    const csv = await service.csv('workspace', 'token');
    expect(csv).toContain('"Market, ""Central"""');
    expect(csv).toContain('"\'=2+2"');
  });

  it('emits a readable multi-page PDF document', () => {
    const pdf = (
      service as unknown as { basicPdf: (lines: string[]) => Buffer }
    ).basicPdf(Array.from({ length: 60 }, (_, index) => `Line ${index + 1}`));
    const text = pdf.toString('ascii');

    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(text).toContain('xref');
    expect(text.endsWith('%%EOF')).toBe(true);
  });
});
