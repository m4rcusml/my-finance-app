import type { BankStrategy, ParsedTransaction } from './bank-strategy.interface';

function parseDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  // DD/MM/YYYY
  const parts = cleaned.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

function parseValue(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');
    const num = Number.parseFloat(cleaned);
    return Number.isNaN(num) ? null : num;
  }
  return null;
}

function findColumn(raw: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    for (const [k, v] of Object.entries(raw)) {
      if (k.toLowerCase() === lowerKey) {
        return v;
      }
    }
  }
  return undefined;
}

export class GenericBankStrategy implements BankStrategy {
  supports(): boolean {
    return true; // fallback
  }

  normalize(raw: Record<string, unknown>): ParsedTransaction | null {
    const date = parseDate(findColumn(raw, ['Data', 'Date', 'data', 'date', 'DATA', 'DATE', 'Dt', 'dt']));
    const description = String(
      findColumn(raw, [
        'Lançamento',
        'Descrição',
        'Descricao',
        'Description',
        'Histórico',
        'Historico',
        'description',
        'descricao',
        'lançamento',
        'descrição',
        'histórico',
        'historico',
        'Memo',
        'memo',
        'Name',
        'name',
      ]) ?? '',
    ).trim();
    const valor = parseValue(
      findColumn(raw, ['Valor', 'Value', 'valor', 'value', 'VALOR', 'VALUE', 'Amount', 'amount']),
    );
    const tipoRaw = String(findColumn(raw, ['Tipo', 'Type', 'tipo', 'type', 'TIPO', 'TYPE']))
      .trim()
      .toLowerCase();

    if (!date || !description || valor === null) {
      return null;
    }

    let type: 'income' | 'expense';
    if (
      tipoRaw === 'entrada' ||
      tipoRaw === 'receita' ||
      tipoRaw === 'income' ||
      tipoRaw === 'credit' ||
      tipoRaw === 'crédito' ||
      tipoRaw === 'credito'
    ) {
      type = 'income';
    } else if (
      tipoRaw === 'saída' ||
      tipoRaw === 'despesa' ||
      tipoRaw === 'expense' ||
      tipoRaw === 'debit' ||
      tipoRaw === 'débito' ||
      tipoRaw === 'debito' ||
      tipoRaw === 'saida'
    ) {
      type = 'expense';
    } else {
      type = valor >= 0 ? 'income' : 'expense';
    }

    return {
      externalId: raw['Id'] ? String(raw['Id']) : undefined,
      date,
      description,
      value: Math.abs(valor),
      type,
    };
  }
}
