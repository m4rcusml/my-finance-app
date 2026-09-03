import type { ImportOrigin } from '@finance/contracts';
import type { RawImportRow } from '../parsers/parser.interface';
import { normaliseKey } from '../parsers/parser.utils';
import type { BankStrategy, NormalizedImportRow } from './bank-strategy.interface';
import { type ColumnAliases, normalizeRow } from './row-normalizer';

/**
 * Banco Inter exports two very different files under the same brand:
 *
 *  - **extrato** (checking account): `Data Lançamento; Lançamento; Valor; Saldo`,
 *    debits negative, credits positive — the usual convention;
 *  - **fatura** (card invoice): `Data; Lançamento; Categoria; Tipo; Valor`,
 *    purchases **positive** and payments/refunds negative — the mirror image.
 *
 * Reading the invoice with the statement convention turns every purchase into
 * income, so the layout is detected from the columns: the invoice carries
 * `Categoria` and never carries `Saldo`.
 */
export const INTER_ALIASES: ColumnAliases = {
  date: ['data lancamento', 'data do lancamento', 'data', 'data da compra', 'date'],
  description: ['lancamento', 'descricao', 'historico', 'memo', 'name', 'estabelecimento', 'description'],
  value: ['valor', 'value', 'amount'],
  type: ['tipo', 'type', 'trntype'],
  sourceId: ['externalid', 'id', 'fitid', 'identificador'],
};

const INVOICE_MARKER = 'categoria';
const STATEMENT_MARKER = 'saldo';

/** True when the row's columns look like a card invoice rather than a statement. */
export function isInvoiceLayout(data: Record<string, unknown>): boolean {
  const columns = Object.keys(data).map(normaliseKey);
  if (columns.includes(STATEMENT_MARKER)) return false;
  return columns.includes(INVOICE_MARKER);
}

export class InterStrategy implements BankStrategy {
  readonly origin: ImportOrigin = 'inter';

  normalize(row: RawImportRow): NormalizedImportRow {
    return normalizeRow(row, INTER_ALIASES, { positiveMeansExpense: isInvoiceLayout(row.data) });
  }
}
