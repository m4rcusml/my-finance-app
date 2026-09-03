'use client';

import { DASHBOARD_PERIODS, type DashboardOverview } from '@finance/contracts';
import { useId } from 'react';
import { type DashboardFilters, PERIOD_LABELS, shiftMonths } from '@/features/dashboard/filters';
import { formatCivilDate } from '@/shared/lib/format';
import { Field, IconButton, TextInput } from '@/shared/ui/form';

/**
 * Period controls.
 *
 * Every control here drives the query. The previous version rendered prev/next
 * arrows above the chart that were bound to nothing at all — a control that
 * does nothing is worse than no control, so these arrows genuinely move the
 * reference date by one month and the whole page refetches.
 */
export function PeriodSelector({
  value,
  onChange,
  rangeError,
  appliedPeriod,
}: {
  value: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
  rangeError?: string;
  /** The window the API actually resolved, echoed back so nothing is implicit. */
  appliedPeriod?: DashboardOverview['period'] | null;
}) {
  const groupName = useId();
  const isCustom = value.period === 'custom';

  return (
    <section
      aria-label="Período exibido"
      className="rounded-2xl border border-border bg-layer01 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4">
        <fieldset className="min-w-0 border-0 p-0">
          <legend className="text-sm font-medium text-foreground">Período</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DASHBOARD_PERIODS.map((period) => (
              <label key={period} className="relative inline-flex cursor-pointer">
                <input
                  type="radio"
                  name={groupName}
                  value={period}
                  checked={value.period === period}
                  onChange={() => onChange({ ...value, period })}
                  className="peer absolute inset-0 size-full cursor-pointer opacity-0"
                />
                <span
                  className="rounded-lg border border-border-strong bg-layer02 px-3 py-2 text-sm font-medium text-muted-foreground transition peer-checked:border-muted-primary peer-checked:bg-primary peer-checked:text-foreground peer-hover:bg-layer03 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-muted-primary"
                >
                  {PERIOD_LABELS[period]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Data de referência" hint="Âncora do período. Vazio usa o dia de hoje.">
            {({ id, describedBy }) => (
              <div className="flex items-center gap-2">
                <IconButton
                  label="Recuar um mês na data de referência"
                  variant="secondary"
                  onClick={() => onChange({ ...value, referenceDate: shiftMonths(value.referenceDate, -1) })}
                >
                  ‹
                </IconButton>
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  type="date"
                  value={value.referenceDate}
                  onChange={(event) => onChange({ ...value, referenceDate: event.target.value })}
                />
                <IconButton
                  label="Avançar um mês na data de referência"
                  variant="secondary"
                  onClick={() => onChange({ ...value, referenceDate: shiftMonths(value.referenceDate, 1) })}
                >
                  ›
                </IconButton>
              </div>
            )}
          </Field>

          {isCustom ? (
            <>
              <Field label="De" required error={rangeError}>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    type="date"
                    value={value.from}
                    max={value.to || undefined}
                    onChange={(event) => onChange({ ...value, from: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Até" required>
                {({ id, describedBy }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={Boolean(rangeError)}
                    type="date"
                    value={value.to}
                    min={value.from || undefined}
                    onChange={(event) => onChange({ ...value, to: event.target.value })}
                  />
                )}
              </Field>
            </>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {appliedPeriod ? (
            <>
              Exibindo de <strong className="text-foreground">{formatCivilDate(appliedPeriod.from)}</strong> a{' '}
              <strong className="text-foreground">{formatCivilDate(appliedPeriod.to)}</strong> (fuso{' '}
              {appliedPeriod.timezone}).
            </>
          ) : (
            'Ajuste o período para carregar os números.'
          )}
        </p>
      </div>
    </section>
  );
}
