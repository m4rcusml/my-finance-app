/**
 * Decimal parsing for pt-BR typists.
 *
 * A Brazilian user types `1.234,56`; a copy-paste from a broker statement is
 * often `1234.56`. `Number()` alone gets the first one wrong (`NaN`), so the
 * comma form is normalised first. Returns `null` for anything unparseable, which
 * the forms turn into a field-level error instead of silently sending `NaN`.
 */
export function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Renders a number back into an editable field without locale separators. */
export function toDecimalInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return String(value);
}
