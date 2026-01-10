import { formatCurrency } from '@/features/dashboard/utils';
import { Card } from './card';

type SummaryCardProps = {
  label: string;
  value?: number;
  trend?: number;
  tone: 'positive' | 'negative' | 'neutral';
};

export function SummaryCard({ label, value, trend, tone }: SummaryCardProps) {
  const toneStyles =
    tone === 'positive'
      ? 'bg-green/20 text-green'
      : tone === 'negative'
        ? 'bg-red/20 text-red'
        : 'bg-layer02 text-muted-foreground';

  return (
    <Card className="flex items-center justify-between px-5 py-4">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground">
          {formatCurrency(value)}
        </p>
      </div>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${toneStyles}`}
      >
        {trend === undefined ? (
          '--'
        ) : (
          <>
            <i
              className={trend >= 0 ? 'lni lni-arrow-up' : 'lni lni-arrow-down'}
              aria-hidden
            />
            {`${trend > 0 ? '+' : ''}${trend.toFixed(0)}%`}
          </>
        )}
      </span>
    </Card>
  );
}
