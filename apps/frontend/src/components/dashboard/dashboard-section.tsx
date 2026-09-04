'use client';

import { useId } from 'react';

/**
 * A titled card. Every block on the dashboard is a landmark with a real heading,
 * so a screen-reader user can jump between "Saldos", "Gráfico anual" and
 * "Recorrentes pendentes" instead of walking the whole page linearly.
 */
export function DashboardSection({
  title,
  description,
  action,
  dataTour,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  dataTour?: string;
  children: React.ReactNode;
}) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-border bg-layer01 p-4 sm:p-5"
      data-tour={dataTour}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-md font-semibold text-foreground">
            {title}
          </h2>
          {description ? <p className="mt-1 max-w-prose text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
