'use client';

import type { PaginationMeta } from '@finance/contracts';

/**
 * Real pagination controls, driven by the `meta` block the API already sends.
 * Without these, every list silently stopped at 20 rows with no way to tell.
 */
export function Pagination({
  meta,
  onPageChange,
  onLimitChange,
  itemLabel = 'registros',
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  itemLabel?: string;
}) {
  const first = meta.totalItems === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.page * meta.limit, meta.totalItems);

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Mostrando <strong>{first}</strong>–<strong>{last}</strong> de <strong>{meta.totalItems}</strong> {itemLabel}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {onLimitChange ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Por página</span>
            <select
              value={meta.limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="rounded-md border border-border-strong bg-layer02 px-2 py-1.5 text-sm text-foreground"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <button
          type="button"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={!meta.hasPreviousPage}
          className="rounded-md border border-border-strong bg-layer02 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-layer03 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Anterior
        </button>
        <span className="text-sm text-muted-foreground">
          Página {meta.page} de {Math.max(1, meta.totalPages)}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={!meta.hasNextPage}
          className="rounded-md border border-border-strong bg-layer02 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-layer03 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Próxima
        </button>
      </div>
    </nav>
  );
}
