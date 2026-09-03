import type { ImportOrigin } from '@finance/contracts';
import type { RawImportRow } from '../parsers/parser.interface';
import type { BankStrategy, NormalizedImportRow } from './bank-strategy.interface';
import { type ColumnAliases, normalizeRow } from './row-normalizer';

/**
 * The catch-all mapping: every column name we have seen in a Brazilian or
 * international statement export, plus the canonical keys the OFX parser emits.
 */
export const GENERIC_ALIASES: ColumnAliases = {
  date: ['data', 'date', 'data lancamento', 'data do lancamento', 'data movimento', 'dt', 'data da compra'],
  description: [
    'descricao',
    'description',
    'lancamento',
    'historico',
    'memo',
    'name',
    'detalhes',
    'estabelecimento',
    'titulo',
  ],
  value: ['valor', 'value', 'amount', 'quantia', 'montante', 'valor (r$)', 'valor r$'],
  type: ['tipo', 'type', 'trntype', 'natureza', 'd/c', 'dc'],
  sourceId: ['externalid', 'id', 'fitid', 'identificador', 'codigo', 'documento'],
  credit: ['credito', 'entrada', 'receita'],
  debit: ['debito', 'saida', 'despesa'],
};

export class GenericBankStrategy implements BankStrategy {
  readonly origin: ImportOrigin = 'generic';

  normalize(row: RawImportRow): NormalizedImportRow {
    return normalizeRow(row, GENERIC_ALIASES);
  }
}
