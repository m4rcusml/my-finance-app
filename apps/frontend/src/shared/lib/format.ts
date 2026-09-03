import type { CivilDate, Money } from '@finance/contracts';

/** pt-BR formatting helpers. Money and civil dates only — no timezone maths here. */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const PERCENT = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const NUMBER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 8 });

export function formatMoney(value: Money | null | undefined): string {
  return BRL.format(typeof value === 'number' && Number.isFinite(value) ? value : 0);
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
  return PERCENT.format(ratio);
}

export function formatQuantity(value: number | null | undefined): string {
  return NUMBER.format(typeof value === 'number' && Number.isFinite(value) ? value : 0);
}

/**
 * Formats `YYYY-MM-DD` for display WITHOUT going through `new Date(string)`,
 * which would reinterpret it as UTC midnight and render the previous day for
 * anybody west of Greenwich — the exact bug this app had.
 */
export function formatCivilDate(date: CivilDate | null | undefined): string {
  if (!date) return '—';
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** `2026-03` -> `março de 2026`. */
export function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  const index = Number(m) - 1;
  if (!year || Number.isNaN(index) || index < 0 || index > 11) return month;
  return `${MONTH_NAMES[index]} de ${year}`;
}

/** `2026-03` -> `mar/26`, for tight axis labels. */
export function formatMonthShort(month: string): string {
  const [year, m] = month.split('-');
  const index = Number(m) - 1;
  if (!year || Number.isNaN(index) || index < 0 || index > 11) return month;
  return `${MONTH_NAMES[index].slice(0, 3)}/${year.slice(2)}`;
}

/** Today in the app timezone, as a civil date, for date input defaults. */
export function todayCivil(timeZone = 'America/Sao_Paulo'): CivilDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  investment: 'Investimento',
  cash: 'Dinheiro',
  other: 'Outro',
};

export const CATEGORY_TYPE_LABELS: Record<string, string> = {
  income: 'Receita',
  expense: 'Despesa',
  both: 'Ambos',
};

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  income: 'Receita',
  expense: 'Despesa',
};

export const TRANSACTION_SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  imported: 'Importada',
  fixed: 'Recorrente',
};

export const OCCURRENCE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  skipped: 'Pulada',
};

export const INVESTMENT_TYPE_LABELS: Record<string, string> = {
  stock: 'Ação',
  fii: 'FII',
  etf: 'ETF',
  crypto: 'Cripto',
  fixed_income: 'Renda fixa',
  fund: 'Fundo',
  other: 'Outro',
};

export const GOAL_TYPE_LABELS: Record<string, string> = {
  saving: 'Poupar',
  spending_limit: 'Limite de gasto',
  debt_payoff: 'Quitar dívida',
  other: 'Outro',
};

export const IMPORT_ORIGIN_LABELS: Record<string, string> = {
  inter: 'Banco Inter',
  generic: 'Genérico',
};

export const IMPORT_STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando confirmação',
  processing: 'Processando',
  completed: 'Concluída',
  failed: 'Falhou',
  expired: 'Expirada',
};
