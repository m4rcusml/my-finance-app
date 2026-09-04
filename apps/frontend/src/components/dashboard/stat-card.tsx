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
  featured = false,
  dataTour,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'negative';
  featured?: boolean;
  dataTour?: string;
  children?: React.ReactNode;
}) {
  const toneClass = featured
    ? 'text-white'
    : tone === 'positive'
      ? 'text-success-text'
      : tone === 'negative'
        ? 'text-danger-text'
        : 'text-foreground';

  return (
    <div
      className={`rounded-2xl border p-4 ${
        featured ? 'border-primary bg-primary shadow-[0_12px_32px_rgba(103,71,237,0.24)]' : 'border-border bg-layer02'
      }`}
      data-tour={dataTour}
    >
      <dt className={`text-xs font-medium ${featured ? 'text-white' : 'text-muted-foreground'}`}>{label}</dt>
      <dd className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</dd>
      {hint ? <dd className={`mt-1 text-xs ${featured ? 'text-white' : 'text-muted-foreground'}`}>{hint}</dd> : null}
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
