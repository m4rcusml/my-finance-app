'use client';

import type { PaginatedResponse } from '@finance/contracts';
import type { UseQueryResult } from '@tanstack/react-query';
import { errorDetails, errorMessage } from '@/shared/lib/api';

/**
 * The four states every screen must render distinctly.
 *
 * The bug this exists to prevent: a failed request rendering as "nenhum
 * registro encontrado". An error is an error, and it says so, with a retry.
 */

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <output
      aria-live="polite"
      className="flex items-center gap-3 rounded-lg border border-border bg-layer01 p-6 text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-layer03 border-t-muted-primary"
      />
      <span className="text-sm">{label}</span>
    </output>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = 'Não foi possível carregar',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const details = errorDetails(error);
  return (
    <div role="alert" className="rounded-lg border border-danger/60 bg-layer01 p-6">
      <h3 className="text-sm font-semibold text-danger-text">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{errorMessage(error)}</p>
      {details.length > 0 ? (
        <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-danger/60 bg-layer02 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-layer03"
        >
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-layer01 p-8 text-center">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {message ? <p className="mx-auto mt-1 max-w-prose text-sm text-muted-foreground">{message}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

interface QueryBoundaryProps<T> {
  query: UseQueryResult<T>;
  children: (data: T) => React.ReactNode;
  loadingLabel?: string;
  errorTitle?: string;
}

/** Renders loading / error / content, never conflating error with empty. */
export function QueryBoundary<T>({ query, children, loadingLabel, errorTitle }: QueryBoundaryProps<T>) {
  if (query.isPending) return <LoadingState label={loadingLabel} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} title={errorTitle} />;
  return <>{children(query.data as T)}</>;
}

interface PaginatedBoundaryProps<T> {
  query: UseQueryResult<PaginatedResponse<T>>;
  children: (items: T[], meta: PaginatedResponse<T>['meta']) => React.ReactNode;
  emptyTitle: string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  loadingLabel?: string;
}

/** The same, plus a genuine empty state that only shows on a *successful* empty page. */
export function PaginatedBoundary<T>({
  query,
  children,
  emptyTitle,
  emptyMessage,
  emptyAction,
  loadingLabel,
}: PaginatedBoundaryProps<T>) {
  if (query.isPending) return <LoadingState label={loadingLabel} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const { data, meta } = query.data;
  if (meta.totalItems === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />;
  }
  return <>{children(data, meta)}</>;
}
