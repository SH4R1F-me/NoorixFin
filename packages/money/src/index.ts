/**
 * @noorixfin/money — Minor-unit integer arithmetic and currency utilities
 *
 * Blueprint §8.1: No floating-point money arithmetic.
 * All amounts stored as minor-unit integers (bigint in DB, number in JS for amounts < Number.MAX_SAFE_INTEGER).
 * API transmits amounts as decimal strings (e.g. "1025" for SAR 10.25).
 * Display formatting uses Intl.NumberFormat per client locale.
 */

// ─── Currency Metadata ───────────────────────────────────────────────

export interface CurrencyInfo {
  /** ISO 4217 code (e.g. "BDT", "SAR", "USD") */
  code: string;
  /** Number of decimal places (e.g. 2 for USD, 0 for JPY, 3 for KWD) */
  exponent: number;
  /** Symbol for display */
  symbol: string;
  /** English name */
  nameEn: string;
  /** Bangla name */
  nameBn: string;
}

/**
 * Currency registry. Extend as needed.
 * Blueprint §8.1: currency metadata with decimal exponent.
 */
export const CURRENCIES: Record<string, CurrencyInfo> = {
  BDT: {
    code: 'BDT',
    exponent: 2,
    symbol: '৳',
    nameEn: 'Bangladeshi Taka',
    nameBn: 'বাংলাদেশী টাকা',
  },
  SAR: { code: 'SAR', exponent: 2, symbol: '﷼', nameEn: 'Saudi Riyal', nameBn: 'সৌদি রিয়াল' },
  USD: { code: 'USD', exponent: 2, symbol: '$', nameEn: 'US Dollar', nameBn: 'মার্কিন ডলার' },
  EUR: { code: 'EUR', exponent: 2, symbol: '€', nameEn: 'Euro', nameBn: 'ইউরো' },
  GBP: { code: 'GBP', exponent: 2, symbol: '£', nameEn: 'British Pound', nameBn: 'ব্রিটিশ পাউন্ড' },
  INR: { code: 'INR', exponent: 2, symbol: '₹', nameEn: 'Indian Rupee', nameBn: 'ভারতীয় রুপি' },
  JPY: { code: 'JPY', exponent: 0, symbol: '¥', nameEn: 'Japanese Yen', nameBn: 'জাপানি ইয়েন' },
  KWD: {
    code: 'KWD',
    exponent: 3,
    symbol: 'د.ك',
    nameEn: 'Kuwaiti Dinar',
    nameBn: 'কুয়েতি দিনার',
  },
  AED: { code: 'AED', exponent: 2, symbol: 'د.إ', nameEn: 'UAE Dirham', nameBn: 'ইউএই দিরহাম' },
  MYR: {
    code: 'MYR',
    exponent: 2,
    symbol: 'RM',
    nameEn: 'Malaysian Ringgit',
    nameBn: 'মালয়েশিয়ান রিঙ্গিত',
  },
};

export function getCurrency(code: string): CurrencyInfo {
  const currency = CURRENCIES[code];
  if (!currency) {
    throw new Error(`Unknown currency code: ${code}`);
  }
  return currency;
}

// ─── Minor-Unit Arithmetic ───────────────────────────────────────────

/**
 * Convert a major-unit amount (e.g. 10.25) to minor-unit integer (e.g. 1025).
 * Blueprint §8.1: stored amount is minor-unit integer.
 */
export function toMinorUnits(majorAmount: number, currencyCode: string): number {
  const currency = getCurrency(currencyCode);
  const multiplier = Math.pow(10, currency.exponent);
  // Round to avoid floating-point artifacts (e.g. 10.25 * 100 = 1024.9999...)
  return Math.round(majorAmount * multiplier);
}

/**
 * Convert a user-entered major-unit decimal string to minor units exactly.
 *
 * This is the input-boundary counterpart to `formatMoney`. It deliberately
 * avoids `Number`, `parseFloat`, multiplication, and rounding: all four can
 * silently change a financial value before it reaches the ledger. The parsed
 * digits are assembled as a BigInt and narrowed only after the safe-integer
 * range has been checked.
 */
export function majorStringToMinorUnits(value: string, currencyCode: string): number {
  const currency = getCurrency(currencyCode);
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) {
    throw new Error(`Invalid major-unit amount: "${value}"`);
  }

  const sign = match[1] ?? '';
  const whole = match[2]!;
  const fraction = match[3] ?? '';
  if (fraction.length > currency.exponent) {
    throw new Error(
      `${currencyCode} accepts at most ${currency.exponent} decimal place${currency.exponent === 1 ? '' : 's'}`,
    );
  }

  const paddedFraction = fraction.padEnd(currency.exponent, '0');
  const scale = 10n ** BigInt(currency.exponent);
  let minor = BigInt(whole) * scale + BigInt(paddedFraction || '0');
  if (sign === '-') minor = -minor;

  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (minor > max || minor < -max) {
    throw new Error(`Amount exceeds safe integer range: "${value}"`);
  }
  return Number(minor);
}

/**
 * Convert a minor-unit integer to major-unit number for display calculation.
 * WARNING: Use Intl.NumberFormat for actual display, not this directly.
 */
export function toMajorUnits(minorAmount: number, currencyCode: string): number {
  const currency = getCurrency(currencyCode);
  const divisor = Math.pow(10, currency.exponent);
  return minorAmount / divisor;
}

/**
 * Parse a decimal string (API format) to minor-unit integer.
 * Blueprint §8.1: API amount is decimal string like "1025".
 */
export function parseMinorUnits(decimalString: string): number {
  // Strict digits-only. Number() is far too permissive for a money primitive:
  // it accepts hex ("0x10" -> 16), scientific notation ("1e3" -> 1000),
  // surrounding whitespace, a leading "+", and "1.0" -> 1. A client sending any
  // of those would have had a silently different amount recorded.
  // Blueprint §8.1 / DEC-004: the wire format is a plain minor-unit integer
  // string such as "1025".
  if (!/^-?\d+$/.test(decimalString)) {
    throw new Error(`Invalid minor-unit amount: "${decimalString}" — must be an integer string`);
  }
  const parsed = Number(decimalString);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`Invalid minor-unit amount: "${decimalString}" — must be an integer string`);
  }
  if (Math.abs(parsed) > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Amount exceeds safe integer range: "${decimalString}"`);
  }
  return parsed;
}

/**
 * Serialize minor-unit integer to decimal string for API.
 * Blueprint §8.1: JSON amount is decimal string, not JSON number.
 */
export function serializeMinorUnits(minorAmount: number): string {
  if (!Number.isInteger(minorAmount)) {
    throw new Error(`Minor-unit amount must be an integer, got: ${minorAmount}`);
  }
  return String(minorAmount);
}

/**
 * Add minor-unit amounts safely. All operands must be same currency.
 */
export function addMinorUnits(...amounts: number[]): number {
  let total = 0;
  for (const amount of amounts) {
    total += amount;
    if (Math.abs(total) > Number.MAX_SAFE_INTEGER) {
      throw new Error('Addition result exceeds safe integer range');
    }
  }
  return total;
}

/**
 * Subtract minor-unit amounts: a - b.
 */
export function subtractMinorUnits(a: number, b: number): number {
  const result = a - b;
  if (Math.abs(result) > Number.MAX_SAFE_INTEGER) {
    throw new Error('Subtraction result exceeds safe integer range');
  }
  return result;
}

/**
 * Negate a minor-unit amount (for debit/credit flip).
 */
export function negateMinorUnits(amount: number): number {
  return -amount;
}

/**
 * Check that total debits equal total credits in a set of postings.
 * Blueprint §8.2: every journal entry must balance.
 */
export function validateBalance(postings: Array<{ debitMinor: number; creditMinor: number }>): {
  balanced: boolean;
  totalDebit: number;
  totalCredit: number;
} {
  let totalDebit = 0;
  let totalCredit = 0;

  for (const posting of postings) {
    if (posting.debitMinor < 0 || posting.creditMinor < 0) {
      throw new Error('Debit and credit amounts must be non-negative');
    }
    if (posting.debitMinor > 0 && posting.creditMinor > 0) {
      throw new Error('A posting cannot have both debit and credit positive');
    }
    if (posting.debitMinor === 0 && posting.creditMinor === 0) {
      throw new Error('A posting cannot have both debit and credit zero');
    }
    totalDebit += posting.debitMinor;
    totalCredit += posting.creditMinor;
  }

  return {
    balanced: totalDebit === totalCredit,
    totalDebit,
    totalCredit,
  };
}

// ─── Display Formatting ──────────────────────────────────────────────

/**
 * Format a minor-unit amount for display using Intl.NumberFormat.
 * Blueprint §8.1: display formatting uses Intl.NumberFormat per client locale.
 */
export function formatMoney(
  minorAmount: number,
  currencyCode: string,
  locale: string = 'en',
): string {
  const currency = getCurrency(currencyCode);
  const majorAmount = minorAmount / Math.pow(10, currency.exponent);

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: currency.exponent,
    maximumFractionDigits: currency.exponent,
  }).format(majorAmount);
}

/**
 * Format amount without currency symbol (just the number).
 */
export function formatAmount(
  minorAmount: number,
  currencyCode: string,
  locale: string = 'en',
): string {
  const currency = getCurrency(currencyCode);
  const majorAmount = minorAmount / Math.pow(10, currency.exponent);

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: currency.exponent,
    maximumFractionDigits: currency.exponent,
  }).format(majorAmount);
}
