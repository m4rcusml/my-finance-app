import type { CivilDate, Money, TransactionType } from '@finance/contracts';
import { isCivilDate, toCivilDate } from '../../common/civil-date';
import { roundMoney } from '../../common/money';
import { normaliseKey } from './parser.utils';

/**
 * Scalar parsing for imported files.
 *
 * The old implementation stripped **every** dot before swapping the comma for a
 * decimal point, so `"1234.56"` became `123456` — every en-US style file was
 * silently imported at 100x its real value. The rules below are explicit about
 * which separator is the decimal one instead of guessing by deletion.
 */

/** `numeric(15,2)` tops out here; anything larger cannot be stored. */
const MAX_MONEY = 9_999_999_999_999.99;

/**
 * Parses an amount written in any of the notations Brazilian and international
 * exports use.
 *
 * | input            | result   | why                                        |
 * |------------------|----------|--------------------------------------------|
 * | `"1.234,56"`     | 1234.56  | comma is rightmost -> decimal separator     |
 * | `"1234,56"`      | 1234.56  | lone comma is always decimal in pt-BR       |
 * | `"1234.56"`      | 1234.56  | lone dot, 2 decimals -> decimal separator   |
 * | `"1,234.56"`     | 1234.56  | dot is rightmost -> decimal separator       |
 * | `"R$ 1.234,56"`  | 1234.56  | currency symbols are ignored                |
 * | `"-45,90"`       | -45.9    | leading sign                                |
 * | `"(45,90)"`      | -45.9    | accounting notation for a negative amount   |
 *
 * Returns `null` — never `NaN`, never `0` — when the text carries no number, so
 * the caller can report a per-row error instead of importing a phantom value.
 */
export function parseMoneyValue(input: unknown): Money | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) && Math.abs(input) <= MAX_MONEY ? roundMoney(input) : null;
  }
  if (typeof input !== 'string') return null;

  let text = input.trim();
  if (text.length === 0) return null;

  let negative = false;

  const parenthesised = /^\((.*)\)$/.exec(text);
  if (parenthesised) {
    negative = true;
    text = parenthesised[1].trim();
  }
  // A minus anywhere (leading, or trailing as some exports write it) is a sign.
  if (text.includes('-') || text.includes('−')) negative = true;

  const digits = text.replace(/[^\d.,]/g, '');
  if (!/\d/.test(digits)) return null;

  const normalised = normaliseSeparators(digits);
  const parsed = Number.parseFloat(normalised);
  if (!Number.isFinite(parsed)) return null;

  const signed = negative ? -Math.abs(parsed) : parsed;
  if (Math.abs(signed) > MAX_MONEY) return null;
  return roundMoney(signed);
}

/** Rewrites a digit/separator string into a plain `1234.56` JS number literal. */
function normaliseSeparators(digits: string): string {
  const lastComma = digits.lastIndexOf(',');
  const lastDot = digits.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    // Whichever separator comes last is the decimal one; the other groups digits.
    const decimal = lastComma > lastDot ? ',' : '.';
    const grouping = decimal === ',' ? '.' : ',';
    return digits.split(grouping).join('').replace(decimal, '.');
  }
  if (lastComma >= 0) return resolveSingleSeparator(digits, ',');
  if (lastDot >= 0) return resolveSingleSeparator(digits, '.');
  return digits;
}

function resolveSingleSeparator(digits: string, separator: ',' | '.'): string {
  const parts = digits.split(separator);
  // `1.234.567` / `1,234,567`: more than one occurrence can only be grouping.
  if (parts.length > 2) return parts.join('');

  const [head, tail] = parts;
  if (separator === '.' && tail.length === 3 && head.length > 0 && head.length <= 3) {
    // `1.234` in a pt-BR export is one thousand two hundred and thirty-four.
    // A real decimal amount in these files always has 1, 2 or 4+ decimals.
    return head + tail;
  }
  return `${head}.${tail}`;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Serial 2958465 is 9999-12-31, the last date Excel can represent. */
const MAX_EXCEL_SERIAL = 2_958_465;
/** Days between 1899-12-31 (Excel serial 1 is 1900-01-01) and the Unix epoch. */
const EXCEL_EPOCH_OFFSET = 25_569;

/**
 * Parses a civil date from whatever a spreadsheet, CSV or OFX row hands over:
 * `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`, `YYYY-MM-DD`, a `Date`, or an Excel
 * numeric serial.
 *
 * Calendar-invalid days (`31/02/2026`) return `null` so the row is reported at
 * preview time. The previous parser happily produced `2026-02-31`, which blew
 * up as a 500 much later, in the middle of the confirm transaction.
 */
export function parseCivilDateValue(input: unknown): CivilDate | null {
  if (input === null || input === undefined) return null;

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : toCivilDate(input);
  }
  if (typeof input === 'number') return excelSerialToCivilDate(input);
  if (typeof input !== 'string') return null;

  const text = input.trim();
  if (text.length === 0) return null;

  // Already civil-shaped: accept it only if it is also a real calendar day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return isCivilDate(text) ? text : null;

  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/.exec(text);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    const candidate = `${year}-${month}-${day}`;
    return isCivilDate(candidate) ? candidate : null;
  }

  // Some XLSX exports quote the serial instead of storing it as a number.
  if (/^\d+(\.\d+)?$/.test(text)) return excelSerialToCivilDate(Number(text));

  return null;
}

/**
 * Converts an Excel/LibreOffice date serial into a civil date.
 *
 * Excel believes 1900 was a leap year, so serials up to 59 are one day ahead of
 * the real count and serial 60 is the day 1900-02-29 that never existed.
 */
export function excelSerialToCivilDate(serial: number): CivilDate | null {
  if (!Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  if (whole < 1 || whole > MAX_EXCEL_SERIAL) return null;
  if (whole === 60) return null;

  const offset = whole > 60 ? EXCEL_EPOCH_OFFSET : EXCEL_EPOCH_OFFSET - 1;
  const date = new Date((whole - offset) * 86_400_000);
  if (Number.isNaN(date.getTime())) return null;

  const civil = toCivilDate(date);
  return isCivilDate(civil) ? civil : null;
}

// ---------------------------------------------------------------------------
// Transaction direction
// ---------------------------------------------------------------------------

const INCOME_WORDS = new Set([
  'entrada',
  'receita',
  'credito',
  'credit',
  'income',
  'deposito',
  'c',
  'cr',
  'rendimento',
]);

const EXPENSE_WORDS = new Set([
  'saida',
  'despesa',
  'debito',
  'debit',
  'expense',
  'saque',
  'd',
  'db',
  'compra',
]);

/**
 * Reads an explicit direction column (`Tipo`, `Type`, `D/C`). Returns `null`
 * when the column says something the app cannot map — the caller then falls
 * back to the sign of the amount rather than guessing.
 */
export function parseTypeHint(input: unknown): TransactionType | null {
  if (input === null || input === undefined) return null;
  const key = normaliseKey(input);
  if (key.length === 0) return null;
  if (INCOME_WORDS.has(key)) return 'income';
  if (EXPENSE_WORDS.has(key)) return 'expense';
  return null;
}
