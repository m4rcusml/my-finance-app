'use client';

import { formatPercent } from '@/shared/lib/format';

/**
 * A trend indicator that never lies.
 *
 * The API sends `trending` as a **percentage number** (`20` means +20%) and
 * `null` when there is no previous window to compare against. `null` renders as
 * an em dash plus "sem base de comparação" — never as a fabricated 0% or 100%,
 * which is what the old card did and which made an empty first month look like
 * a perfectly flat one.
 *
 * Colour alone never carries the meaning (WCAG 1.4.1): the direction is spelled
 * out in text for assistive tech and an arrow glyph backs up the colour visually.
 */
export function TrendBadge({
  trending,
  /** Which direction is the good one — up for income, down for expense. */
  goodWhen = 'up',
  comparisonLabel = 'em relação ao período anterior',
}: {
  trending: number | null;
  goodWhen?: 'up' | 'down';
  comparisonLabel?: string;
}) {
  if (trending === null || !Number.isFinite(trending)) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        <span aria-hidden="true">— </span>
        sem base de comparação
      </p>
    );
  }

  const rounded = Math.round(trending * 10) / 10;
  const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
  const magnitude = formatPercent(Math.abs(rounded) / 100);

  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
  const spoken =
    direction === 'up'
      ? `alta de ${magnitude} ${comparisonLabel}`
      : direction === 'down'
        ? `queda de ${magnitude} ${comparisonLabel}`
        : `estável ${comparisonLabel}`;

  const isGood =
    direction === 'flat' ? null : goodWhen === 'up' ? direction === 'up' : direction === 'down';

  const tone =
    isGood === null ? 'text-muted-foreground' : isGood ? 'text-success-text' : 'text-danger-text';

  return (
    <p className={`mt-1 text-xs font-medium ${tone}`}>
      <span aria-hidden="true">
        {arrow} {magnitude}
      </span>
      <span className="sr-only">{spoken}</span>
    </p>
  );
}
