import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  majorStringToMinorUnits,
  toMajorUnits,
  parseMinorUnits,
  serializeMinorUnits,
  addMinorUnits,
  subtractMinorUnits,
  negateMinorUnits,
  validateBalance,
  formatMoney,
  formatAmount,
  getCurrency,
} from './index';

describe('@noorixfin/money', () => {
  // ─── Currency Registry ─────────────────────────────────────────
  describe('getCurrency', () => {
    it('returns metadata for known currencies', () => {
      const bdt = getCurrency('BDT');
      expect(bdt.code).toBe('BDT');
      expect(bdt.exponent).toBe(2);
      expect(bdt.symbol).toBe('৳');
    });

    it('throws for unknown currency', () => {
      expect(() => getCurrency('XXX')).toThrow('Unknown currency code: XXX');
    });

    it('handles zero-exponent currencies (JPY)', () => {
      const jpy = getCurrency('JPY');
      expect(jpy.exponent).toBe(0);
    });

    it('handles three-exponent currencies (KWD)', () => {
      const kwd = getCurrency('KWD');
      expect(kwd.exponent).toBe(3);
    });
  });

  // ─── Minor-Unit Conversion ─────────────────────────────────────
  describe('toMinorUnits', () => {
    it('converts BDT 10.25 to 1025', () => {
      expect(toMinorUnits(10.25, 'BDT')).toBe(1025);
    });

    it('converts JPY 100 to 100 (zero exponent)', () => {
      expect(toMinorUnits(100, 'JPY')).toBe(100);
    });

    it('converts KWD 1.234 to 1234 (three exponent)', () => {
      expect(toMinorUnits(1.234, 'KWD')).toBe(1234);
    });

    it('handles zero amount', () => {
      expect(toMinorUnits(0, 'USD')).toBe(0);
    });

    it('handles negative amounts', () => {
      expect(toMinorUnits(-5.5, 'USD')).toBe(-550);
    });

    it('rounds floating-point artifacts correctly', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JS
      expect(toMinorUnits(0.1 + 0.2, 'USD')).toBe(30);
    });
  });

  describe('majorStringToMinorUnits', () => {
    it.each([
      ['10.25', 'BDT', 1025],
      ['100', 'JPY', 100],
      ['1.234', 'KWD', 1234],
      ['0.10', 'USD', 10],
      ['-5.50', 'USD', -550],
    ])('parses %s %s without floating point', (value, currency, expected) => {
      expect(majorStringToMinorUnits(value, currency)).toBe(expected);
    });

    it('rejects fractions beyond the currency exponent', () => {
      expect(() => majorStringToMinorUnits('1.001', 'USD')).toThrow('at most 2 decimal places');
      expect(() => majorStringToMinorUnits('1.0', 'JPY')).toThrow('at most 0 decimal places');
    });

    it.each(['1e3', '0x10', '+1', ' 1', '1 ', '.5', '1.'])(
      'rejects non-canonical input %s',
      (value) => {
        expect(() => majorStringToMinorUnits(value, 'USD')).toThrow('Invalid major-unit amount');
      },
    );

    it('rejects values outside the exact JavaScript integer range', () => {
      expect(() => majorStringToMinorUnits('90071992547410.00', 'USD')).toThrow(
        'safe integer range',
      );
    });
  });

  describe('toMajorUnits', () => {
    it('converts 1025 BDT minor to 10.25', () => {
      expect(toMajorUnits(1025, 'BDT')).toBe(10.25);
    });

    it('converts 100 JPY minor to 100', () => {
      expect(toMajorUnits(100, 'JPY')).toBe(100);
    });
  });

  // ─── API Serialization ─────────────────────────────────────────
  describe('parseMinorUnits', () => {
    it('parses valid integer string', () => {
      expect(parseMinorUnits('1025')).toBe(1025);
    });

    it('parses negative integer string', () => {
      expect(parseMinorUnits('-500')).toBe(-500);
    });

    it('parses zero', () => {
      expect(parseMinorUnits('0')).toBe(0);
    });

    it('rejects float string', () => {
      expect(() => parseMinorUnits('10.25')).toThrow('must be an integer string');
    });

    it('rejects non-numeric string', () => {
      expect(() => parseMinorUnits('abc')).toThrow('must be an integer string');
    });

    it('rejects empty string', () => {
      expect(() => parseMinorUnits('')).toThrow('must be an integer string');
    });
  });

  describe('parseMinorUnits — strict format (regression)', () => {
    // Number() accepted all of these before the strict regex landed, so a client
    // could have had a silently different amount recorded than it sent.
    it.each(['1e3', '0x10', ' 100 ', '100\n', '+100', '1.0', '1_000', 'Infinity', '-0x1'])(
      'rejects %p',
      (input) => {
        expect(() => parseMinorUnits(input)).toThrow();
      },
    );

    it.each([
      ['0', 0],
      ['1025', 1025],
      ['-1025', -1025],
      ['999999999999', 999999999999],
    ])('accepts %p', (input, expected) => {
      expect(parseMinorUnits(input as string)).toBe(expected);
    });
  });

  describe('serializeMinorUnits', () => {
    it('serializes integer to string', () => {
      expect(serializeMinorUnits(1025)).toBe('1025');
    });

    it('serializes zero', () => {
      expect(serializeMinorUnits(0)).toBe('0');
    });

    it('serializes negative', () => {
      expect(serializeMinorUnits(-500)).toBe('-500');
    });

    it('rejects non-integer', () => {
      expect(() => serializeMinorUnits(10.5)).toThrow('must be an integer');
    });
  });

  // ─── Arithmetic ────────────────────────────────────────────────
  describe('addMinorUnits', () => {
    it('adds multiple amounts', () => {
      expect(addMinorUnits(100, 200, 300)).toBe(600);
    });

    it('handles single amount', () => {
      expect(addMinorUnits(100)).toBe(100);
    });

    it('handles empty', () => {
      expect(addMinorUnits()).toBe(0);
    });

    it('handles negatives', () => {
      expect(addMinorUnits(100, -50)).toBe(50);
    });
  });

  describe('subtractMinorUnits', () => {
    it('subtracts correctly', () => {
      expect(subtractMinorUnits(1000, 300)).toBe(700);
    });

    it('handles negative result', () => {
      expect(subtractMinorUnits(100, 500)).toBe(-400);
    });
  });

  describe('negateMinorUnits', () => {
    it('negates positive', () => {
      expect(negateMinorUnits(100)).toBe(-100);
    });

    it('negates negative', () => {
      expect(negateMinorUnits(-100)).toBe(100);
    });

    it('negates zero', () => {
      expect(negateMinorUnits(0)).toBe(-0);
    });
  });

  // ─── Balance Validation (Blueprint §8.2) ───────────────────────
  describe('validateBalance', () => {
    it('returns balanced for valid expense posting', () => {
      // Expense: Asset credit + Expense debit
      const result = validateBalance([
        { debitMinor: 0, creditMinor: 1000 }, // Asset account credit
        { debitMinor: 1000, creditMinor: 0 }, // Expense category debit
      ]);
      expect(result.balanced).toBe(true);
      expect(result.totalDebit).toBe(1000);
      expect(result.totalCredit).toBe(1000);
    });

    it('returns balanced for income posting', () => {
      // Income: Income credit + Asset debit
      const result = validateBalance([
        { debitMinor: 5000, creditMinor: 0 }, // Asset account debit
        { debitMinor: 0, creditMinor: 5000 }, // Income category credit
      ]);
      expect(result.balanced).toBe(true);
    });

    it('returns balanced for transfer', () => {
      // Transfer: Source credit + Destination debit
      const result = validateBalance([
        { debitMinor: 0, creditMinor: 2000 }, // Source account credit
        { debitMinor: 2000, creditMinor: 0 }, // Destination account debit
      ]);
      expect(result.balanced).toBe(true);
    });

    it('returns imbalanced when debits != credits', () => {
      const result = validateBalance([
        { debitMinor: 0, creditMinor: 1000 },
        { debitMinor: 999, creditMinor: 0 },
      ]);
      expect(result.balanced).toBe(false);
    });

    it('throws for both debit and credit positive', () => {
      expect(() => validateBalance([{ debitMinor: 100, creditMinor: 100 }])).toThrow(
        'cannot have both debit and credit positive',
      );
    });

    it('throws for both debit and credit zero', () => {
      expect(() => validateBalance([{ debitMinor: 0, creditMinor: 0 }])).toThrow(
        'cannot have both debit and credit zero',
      );
    });

    it('throws for negative amounts', () => {
      expect(() => validateBalance([{ debitMinor: -100, creditMinor: 0 }])).toThrow(
        'must be non-negative',
      );
    });

    it('handles split transactions (multiple postings)', () => {
      // Split expense: Cash pays for Food (600) and Transport (400)
      const result = validateBalance([
        { debitMinor: 0, creditMinor: 1000 }, // Cash credit
        { debitMinor: 600, creditMinor: 0 }, // Food debit
        { debitMinor: 400, creditMinor: 0 }, // Transport debit
      ]);
      expect(result.balanced).toBe(true);
    });
  });

  // ─── Display Formatting ────────────────────────────────────────
  describe('formatMoney', () => {
    it('formats BDT in English', () => {
      const formatted = formatMoney(1025, 'BDT', 'en');
      expect(formatted).toContain('10.25');
    });

    it('formats USD', () => {
      const formatted = formatMoney(9999, 'USD', 'en');
      expect(formatted).toContain('99.99');
    });

    it('formats JPY (zero decimal)', () => {
      const formatted = formatMoney(100, 'JPY', 'en');
      expect(formatted).toContain('100');
    });

    it('formats zero amount', () => {
      const formatted = formatMoney(0, 'USD', 'en');
      expect(formatted).toContain('0.00');
    });
  });

  describe('formatAmount', () => {
    it('formats without currency symbol', () => {
      const formatted = formatAmount(1025, 'BDT', 'en');
      expect(formatted).toBe('10.25');
    });
  });
});
