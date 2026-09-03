import type { CivilDate, Money, OccurrenceStatus } from '@finance/contracts';
import { formatMonthLabel, todayCivil } from '@/shared/lib/format';

/**
 * Small pure helpers for the recurring-transactions screens.
 *
 * Nothing here touches `new Date(civilDate)`: every date value stays a
 * `YYYY-MM-DD` string from the API to the `<input type="date">` and back.
 */

export const MONTH_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

/** `2026`, `3` -> `março de 2026`. */
export function periodLabel(year: number, month: number): string {
  return formatMonthLabel(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`);
}

/** Current civil year in the app timezone, without ever constructing a local Date. */
export function currentCivilYear(): number {
  return Number(todayCivil().slice(0, 4));
}

/** Years offered by the occurrence filter: a window around today, newest first. */
export function yearOptions(): number[] {
  const current = currentCivilYear();
  const years: number[] = [];
  for (let year = current + 1; year >= current - 5; year -= 1) years.push(year);
  return years;
}

/**
 * Parses what a Brazilian actually types into a money field.
 *
 * `1.234,56` and `1234.56` both mean the same number, so the comma decides:
 * when it is present the dots are thousands separators, otherwise the dot is
 * the decimal point. Returns `null` for anything that is not a plain number.
 */
export function parseMoneyInput(raw: string): Money | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100) / 100;
}

/** Renders a `Money` back into an editable pt-BR string (no grouping, so it round-trips). */
export function toMoneyInput(value: Money): string {
  return value.toFixed(2).replace('.', ',');
}

/** Parses an integer field, returning `null` when it is empty or malformed. */
export function parseIntegerInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '' || !/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export const OCCURRENCE_STATUS_STYLES: Record<OccurrenceStatus, string> = {
  pending: 'border-warning/60 bg-layer02 text-warning-text',
  confirmed: 'border-success/60 bg-layer02 text-success-text',
  skipped: 'border-border-strong bg-layer02 text-muted-foreground',
};

/** `pending` is the only state that still accepts an action. */
export function isFinalStatus(status: OccurrenceStatus): boolean {
  return status !== 'pending';
}

/** Guards the date input against a value the API would reject outright. */
export function isCivilDateInput(value: string): value is CivilDate {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
