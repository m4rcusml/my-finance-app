import { formatCurrency } from '@/shared/lib/utils';

type SummaryCardProps = {
  label: string;
  value?: number;
  trend?: number;
  tone: 'positive' | 'negative' | 'neutral';
  bgColor?: 'layer01' | 'layer02';
};

import { Label } from '@/components/ui/label';

export function SummaryCard({ label, value, trend, tone, bgColor = 'layer01' }: SummaryCardProps) {
  const labelTone =
    trend === 0
      ? 'neutral'
      : tone === 'positive'
        ? 'success'
        : tone === 'negative'
          ? 'danger'
          : bgColor === 'layer01'
            ? 'layer02'
            : 'layer01';

  return (
    <div className={`flex items-center justify-between px-6 py-2 rounded-3xl border border-foreground/5 bg-${bgColor}`}>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground">{formatCurrency(value)}</p>
      </div>
      <Label
        tone={labelTone}
        leftIcon={trend !== undefined ? (trend >= 0 ? 'ArrowUpwardOutlined' : 'ArrowDownwardOutlined') : undefined}
      >
        {trend === undefined ? '--' : `${trend > 0 ? '+' : ''}${trend.toFixed(0)}%`}
      </Label>
    </div>
  );
}
