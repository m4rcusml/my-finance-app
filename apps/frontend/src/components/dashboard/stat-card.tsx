'use client';

/**
 * One figure inside a `<dl>`. The hint is a second `<dd>` rather than a
 * `title` attribute so it is readable by everyone, including touch users and
 * screen readers, and so "isto não é dinheiro disponível" can actually be read.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'negative';
  children?: React.ReactNode;
}) {
  const toneClass =
    tone === 'positive' ? 'text-success-text' : tone === 'negative' ? 'text-danger-text' : 'text-foreground';

  return (
    <div className="rounded-xl border border-border bg-layer02 p-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}>{value}</dd>
      {hint ? <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd> : null}
      {children ? <dd>{children}</dd> : null}
    </div>
  );
}

/** Sign-driven tone for a money figure, so a negative balance reads as negative. */
export function moneyTone(value: number): 'neutral' | 'positive' | 'negative' {
  if (value < 0) return 'negative';
  if (value > 0) return 'positive';
  return 'neutral';
}
