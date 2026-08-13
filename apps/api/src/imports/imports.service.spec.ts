import { ImportsService } from './imports.service';

describe('ImportsService statement parsers', () => {
  const service = new ImportsService({} as never, {} as never);
  const parse = (format: 'CSV' | 'OFX' | 'QIF', content: string) =>
    (
      service as unknown as {
        parse: (kind: string, value: string) => Array<Record<string, unknown>>;
      }
    ).parse(format, content);

  it('parses quoted CSV fields without losing commas or escaped quotes', () => {
    const rows = parse(
      'CSV',
      'date,amount,payee,note\r\n2026-08-13,-12.50,"Market, Central","said ""thanks"""',
    );

    expect(rows).toEqual([
      expect.objectContaining({
        date: '2026-08-13T12:00:00.000Z',
        amount: '-12.50',
        payee: 'Market, Central',
        note: 'said "thanks"',
      }),
    ]);
  });

  it('rejects an unterminated quoted CSV field', () => {
    expect(() =>
      parse('CSV', 'date,amount,payee\n2026-08-13,-2,"broken'),
    ).toThrow('unterminated quoted field');
  });

  it('rejects calendar dates that JavaScript would otherwise normalise', () => {
    expect(() =>
      parse('CSV', 'date,amount,payee\n2026-02-31,-2,Impossible'),
    ).toThrow('Invalid date: 2026-02-31');
  });

  it('parses SGML-style OFX and QIF statement rows', () => {
    const ofx = parse(
      'OFX',
      '<BANKTRANLIST><STMTTRN><DTPOSTED>20260813120000[-5:EST]<TRNAMT>-4.25<NAME>Cafe<MEMO>Lunch</STMTTRN></BANKTRANLIST>',
    );
    const qif = parse(
      'QIF',
      '!Type:Bank\nD8/13/26\nT125.00\nPSalary\nMMonthly\n^',
    );

    expect(ofx[0]).toEqual(
      expect.objectContaining({
        amount: '-4.25',
        payee: 'Cafe',
        date: '2026-08-13T12:00:00.000Z',
      }),
    );
    expect(qif[0]).toEqual(
      expect.objectContaining({
        amount: '125.00',
        payee: 'Salary',
        date: '2026-08-13T12:00:00.000Z',
      }),
    );
  });

  it('derives deterministic RFC 4122-shaped row keys', () => {
    const rowKey = (
      service as unknown as { rowKey: (job: string, row: number) => string }
    ).rowKey;
    const first = rowKey.call(service, 'job', 7);
    const again = rowKey.call(service, 'job', 7);

    expect(first).toBe(again);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('converts decimal statement amounts without floating-point rounding', () => {
    const decimalToMinor = (
      service as unknown as {
        decimalToMinor: (amount: string, currency: string) => number;
      }
    ).decimalToMinor;

    expect(decimalToMinor.call(service, '900719925474.09', 'USD')).toBe(
      90071992547409,
    );
    expect(() => decimalToMinor.call(service, '1.001', 'USD')).toThrow(
      'more than 2 decimal places',
    );
  });
});
