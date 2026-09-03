'use client';

import type { MonthlyNet } from '@finance/contracts';
import { formatMonthLabel, formatMonthShort, formatMoney } from '@/shared/lib/format';
import { DashboardSection } from './dashboard-section';

/**
 * Twelve months of income vs expense.
 *
 * Two rules are structural here:
 *
 *  1. bars, month labels and table rows all come from ONE iteration over
 *     `entries`. The old chart mapped bars from one array and labels from a
 *     month index, so a zero-filled gap shifted every label by one;
 *  2. the graphic is `aria-hidden` and the numbers live in a visually hidden
 *     `<table>`. A chart with no text alternative is a WCAG 1.1.1 failure, and
 *     "read the picture" is not an option for a screen-reader user.
 *
 * Month names come from `entry.month` (`YYYY-MM`) through `formatMonthShort`,
 * never from the position in the array.
 */
export function AnnualBalanceChart({ entries }: { entries: MonthlyNet[] }) {
  const max = entries.reduce((acc, entry) => Math.max(acc, entry.income, entry.expense), 0);
  const hasMovement = max > 0;

  /** Bar height as a percentage of the tallest bar, with a visible floor. */
  const heightOf = (value: number): string => {
    if (!hasMovement || value <= 0) return '0%';
    return `${Math.max((value / max) * 100, 2)}%`;
  };

  return (
    <DashboardSection
      title="Balanço anual"
      description="Receitas e despesas dos últimos 12 meses, terminando no mês de referência."
    >
      <figure className="m-0">
        <figcaption className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="inline-block size-3 rounded-sm bg-success" />
            Receitas
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="inline-block size-3 rounded-sm bg-danger" />
            Despesas
          </span>
          {hasMovement ? (
            <span>Maior valor do período: {formatMoney(max)}</span>
          ) : (
            <span>Sem movimentação registrada nos últimos 12 meses.</span>
          )}
        </figcaption>

        {/* Scrolls horizontally instead of squashing twelve columns at 320px. */}
        <div className="overflow-x-auto pb-2">
          <div aria-hidden="true" className="flex min-w-[34rem] items-end gap-2">
            {entries.map((entry) => (
              <div key={entry.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-40 w-full items-end justify-center gap-1 rounded-md bg-layer02/60 p-1">
                  <div className="w-1/3 rounded-t-sm bg-success" style={{ height: heightOf(entry.income) }} />
                  <div className="w-1/3 rounded-t-sm bg-danger" style={{ height: heightOf(entry.expense) }} />
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground">{formatMonthShort(entry.month)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Keep the intrinsic table inside the clipped box. Applying `sr-only`
            directly to a table lets its column algorithm widen the document. */}
        <div className="sr-only">
          <table>
            <caption>Receitas, despesas e saldo mês a mês nos últimos 12 meses</caption>
            <thead>
              <tr>
                <th scope="col">Mês</th>
                <th scope="col">Receitas</th>
                <th scope="col">Despesas</th>
                <th scope="col">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.month}>
                  <th scope="row">{formatMonthLabel(entry.month)}</th>
                  <td>{formatMoney(entry.income)}</td>
                  <td>{formatMoney(entry.expense)}</td>
                  <td>{formatMoney(entry.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </figure>
    </DashboardSection>
  );
}
