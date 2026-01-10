import { Lineicons } from '@lineiconshq/react-lineicons';
import { ArrowLeftOutlined, ArrowRightOutlined } from '@lineiconshq/free-icons';
import { Card } from './card';
import { monthLabels } from '@/features/dashboard/utils';
import { sampleMonthlyNet } from '@/features/dashboard/sample-data';

type AnnualBalanceProps = {
  monthlyNet?: number[];
};

export function AnnualBalance({ monthlyNet = sampleMonthlyNet }: AnnualBalanceProps) {
  const maxValue = Math.max(...monthlyNet.map((value) => Math.abs(value)), 1);

  return (
    <Card className="px-6 py-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-layer02 text-sm text-muted-foreground"
        >
          <Lineicons icon={ArrowLeftOutlined} size={16} aria-hidden />
        </button>
        <h3 className="text-base font-medium text-foreground">Balanco anual</h3>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-layer02 text-sm text-muted-foreground"
        >
          <Lineicons icon={ArrowRightOutlined} size={16} aria-hidden />
        </button>
      </div>
      <div className="mt-6 flex h-56 items-end gap-3">
        {monthlyNet.map((value, index) => {
          const height = `${(Math.abs(value) / maxValue) * 100}%`;
          const color = value >= 0 ? 'bg-green' : 'bg-red';
          return (
            <div key={monthLabels[index]} className="flex flex-1 flex-col items-center gap-2">
              <div className={`w-full rounded-2xl ${color}`} style={{ height }} />
              <span className="text-xs text-muted-foreground">{monthLabels[index]}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-foreground/10 bg-layer02 px-4 py-4 text-sm text-muted-foreground">
        <p className="text-xs text-muted-foreground">Legenda</p>
        <div className="mt-3 flex items-center gap-4 text-xs">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-green" />
            Saldo positivo
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-red" />
            Saldo negativo
          </span>
        </div>
      </div>
    </Card>
  );
}
