import type { RawImportRow } from '../parsers/parser.interface';
import { normaliseKey } from '../parsers/parser.utils';
import { parseCivilDateValue, parseMoneyValue, parseTypeHint } from '../parsers/value.parser';
import type { NormalizedImportRow } from './bank-strategy.interface';

/**
 * Column aliases, already accent- and case-insensitive: lookups go through
 * `normaliseKey`, so `Lançamento`, `LANCAMENTO` and `lancamento` are one alias.
 */
export interface ColumnAliases {
  date: string[];
  description: string[];
  value: string[];
  type: string[];
  sourceId: string[];
  /** Layouts that split the amount into two one-sided columns. */
  credit?: string[];
  debit?: string[];
}

export interface NormalizeOptions {
  /**
   * `true` for a credit-card invoice, where a purchase is written as a positive
   * amount and a payment or refund as a negative one — the mirror image of a
   * checking-account statement. Only consulted when the file gives no explicit
   * direction column.
   */
  positiveMeansExpense?: boolean;
}

export const ERROR_MISSING_DATE = 'Data ausente.';
export const ERROR_INVALID_DATE = 'Data inválida: use DD/MM/AAAA.';
export const ERROR_MISSING_VALUE = 'Valor ausente.';
export const ERROR_INVALID_VALUE = 'Valor inválido.';

/** Case/accent-insensitive column lookup; the first alias that exists wins. */
export function pickColumn(data: Record<string, unknown>, aliases: readonly string[]): unknown {
  const index = new Map<string, unknown>();
  for (const [key, value] of Object.entries(data)) {
    const normalised = normaliseKey(key);
    if (!index.has(normalised)) index.set(normalised, value);
  }
  for (const alias of aliases) {
    const value = index.get(normaliseKey(alias));
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

/**
 * Maps one raw row onto `NormalizedImportRow`, collecting a pt-BR error per
 * problem instead of throwing. `value` always comes back positive: the sign of
 * the source amount is folded into `type`, which is what the ledger stores.
 */
export function normalizeRow(
  row: RawImportRow,
  aliases: ColumnAliases,
  options: NormalizeOptions = {},
): NormalizedImportRow {
  const { data } = row;
  const errors: string[] = [];

  const rawDate = pickColumn(data, aliases.date);
  const date = parseCivilDateValue(rawDate);
  if (date === null) errors.push(rawDate === undefined ? ERROR_MISSING_DATE : ERROR_INVALID_DATE);

  const rawValue = pickColumn(data, aliases.value);
  let signedValue = parseMoneyValue(rawValue);
  let splitColumnSign: 1 | -1 | null = null;

  if (signedValue === null) {
    // Layouts with separate Crédito / Débito columns.
    const credit = aliases.credit ? parseMoneyValue(pickColumn(data, aliases.credit)) : null;
    const debit = aliases.debit ? parseMoneyValue(pickColumn(data, aliases.debit)) : null;
    if (credit !== null && credit !== 0) {
      signedValue = Math.abs(credit);
      splitColumnSign = 1;
    } else if (debit !== null && debit !== 0) {
      signedValue = -Math.abs(debit);
      splitColumnSign = -1;
    }
  }

  if (signedValue === null) {
    const missing = rawValue === undefined && splitColumnSign === null;
    errors.push(missing ? ERROR_MISSING_VALUE : ERROR_INVALID_VALUE);
  }

  const description = readDescription(data, aliases.description);
  const sourceId = readSourceId(data, aliases.sourceId);
  const type = resolveType(pickColumn(data, aliases.type), signedValue, splitColumnSign, options);

  return {
    rowNumber: row.rowNumber,
    type,
    value: signedValue === null ? null : Math.abs(signedValue),
    date,
    description,
    sourceId,
    errors,
  };
}

function readDescription(data: Record<string, unknown>, aliases: readonly string[]): string | null {
  const raw = pickColumn(data, aliases);
  if (raw === undefined) return null;
  const text = String(raw).trim().slice(0, 500);
  return text.length > 0 ? text : null;
}

function readSourceId(data: Record<string, unknown>, aliases: readonly string[]): string | null {
  const raw = pickColumn(data, aliases);
  if (raw === undefined) return null;
  const text = String(raw).trim().slice(0, 200);
  return text.length > 0 ? text : null;
}

function resolveType(
  rawType: unknown,
  signedValue: number | null,
  splitColumnSign: 1 | -1 | null,
  options: NormalizeOptions,
): NormalizedImportRow['type'] {
  // An explicit direction column always wins over the sign of the amount.
  const hint = parseTypeHint(rawType);
  if (hint !== null) return hint;

  // A one-sided Crédito/Débito column is itself explicit.
  if (splitColumnSign !== null) return splitColumnSign === 1 ? 'income' : 'expense';

  if (signedValue === null) return null;
  if (options.positiveMeansExpense) return signedValue >= 0 ? 'expense' : 'income';
  return signedValue >= 0 ? 'income' : 'expense';
}
