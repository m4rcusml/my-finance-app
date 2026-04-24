import type { BankStrategy, ParsedTransaction } from './bank-strategy.interface';

function parseDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  // Try DD/MM/YYYY
  const parts = cleaned.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Try YYYY-MM-DD
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

export class InterStrategy implements BankStrategy {
  supports(origin: string): boolean {
    return origin.toLowerCase() === 'inter';
  }

  normalize(raw: Record<string, unknown>): ParsedTransaction | null {
    const date = parseDate(raw['Data'] ?? raw['data'] ?? raw['Date']);
    const description = String(
      raw['Lançamento'] ?? raw['lançamento'] ?? raw['Descricao'] ?? raw['Descrição'] ?? raw['description'] ?? '',
    ).trim();
    const valor = parseValue(raw['Valor'] ?? raw['valor'] ?? raw['value']);
    const tipoRaw = String(raw['Tipo'] ?? raw['tipo'] ?? raw['type'] ?? '')
      .trim()
      .toLowerCase();

    if (!date || !description || valor === null) {
      return null;
    }

    // Inter exports use positive/negative values or explicit tipo
    let type: 'income' | 'expense';
    if (tipoRaw === 'entrada' || tipoRaw === 'receita' || tipoRaw === 'income') {
      type = 'income';
    } else if (tipoRaw === 'saída' || tipoRaw === 'despesa' || tipoRaw === 'expense' || tipoRaw === 'saida') {
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
