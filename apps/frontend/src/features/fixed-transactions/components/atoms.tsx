'use client';

import type { OccurrenceStatus } from '@finance/contracts';
import { OCCURRENCE_STATUS_LABELS } from '@/shared/lib/format';
import { OCCURRENCE_STATUS_STYLES } from '../helpers';

/** Local presentational pieces. Anything reusable across features lives in `shared/ui`. */

export function OccurrenceStatusBadge({ status }: { status: OccurrenceStatus }) {
  return (
    <span
      className={`inline-flex min-h-9 min-w-28 items-center justify-center rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap ${OCCURRENCE_STATUS_STYLES[status]}`}
    >
      {status === 'skipped' ? 'Ignorada' : OCCURRENCE_STATUS_LABELS[status]}
    </span>
  );
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
        isActive
          ? 'border-success/60 bg-layer02 text-success-text'
          : 'border-border-strong bg-layer02 text-muted-foreground'
      }`}
    >
      {isActive ? 'Ativo' : 'Arquivado'}
    </span>
  );
}

/**
 * A compact table-row action. It always carries visible text, so it never needs
 * an `aria-label` bolted on, and it is a real `<button>` — reachable by keyboard
 * and announced with its name.
 */
export function RowAction({
  children,
  onClick,
  disabled,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border border-border-strong bg-layer02 px-2.5 py-1 text-xs font-medium whitespace-nowrap transition hover:bg-layer03 disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'danger' ? 'text-danger-text' : 'text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * A horizontally scrollable table wrapper.
 *
 * The `tabIndex`/`role`/`aria-label` trio is what makes an overflowing region
 * operable by keyboard — without it a mouse can scroll to the action column at
 * 320px but a keyboard cannot.
 */
export function TableScroller({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable to be keyboard-operable.
    <section tabIndex={0} aria-label={label} className="overflow-x-auto rounded-lg border border-border">
      {children}
    </section>
  );
}

/** A note the user must not miss, rendered as real text rather than a tooltip. */
export function Callout({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-border bg-layer01 p-3 text-xs text-muted-foreground">{children}</p>;
}
