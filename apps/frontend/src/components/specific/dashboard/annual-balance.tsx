import { monthLabels } from '@/features/dashboard/utils';
import { Button } from '@/components/ui/button';

type AnnualBalanceProps = {
  monthlyNet?: number[];
};

const sampleMonthlyNet = new Array(12).fill(0);

export function AnnualBalance({ monthlyNet = sampleMonthlyNet }: AnnualBalanceProps) {
  const _maxValue = Math.max(...monthlyNet.map((value) => Math.abs(value)), 1);

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-layer01 flex justify-between items-center px-4 py-2 rounded-4xl">
        <Button tone="layer01" leftIcon="ArrowLeftOutlined" />

        <span className="text-md">Balanço anual</span>

        <Button tone="layer01" rightIcon="ArrowRightOutlined" />
      </div>

      <div className="flex-1">
        <div className=" relative h-full flex items-end px-4 py-2">
          {monthlyNet.map((value, index) => (
            <div key={monthLabels[index]} className="flex-1 flex items-end justify-center h-full px-1">
              <div
                className={`w-full rounded-t-xl ${value > 0 ? 'bg-green' : value < 0 ? 'bg-red' : 'bg-layer02/70'}`}
                style={{ height: `${Math.max(_maxValue === 1 ? 40 : 5, (Math.abs(value) / _maxValue) * 100)}%` }}
              />
            </div>
          ))}

          {_maxValue === 1 && (
            <span className="absolute left-1/2 bottom-1/2 -translate-1/2">Nenhum dado disponível</span>
          )}
        </div>
      </div>

      <div className="bg-layer01 rounded-4xl overflow-hidden">
        <div className="bg-layer02 flex items-center px-4 py-2">
          {monthLabels.map((label) => (
            <span key={label} className="flex-1 text-center">
              {label}
            </span>
          ))}
        </div>

        <div className="px-6 py-4 flex flex-col gap-4">
          <span className="text-md">Legenda</span>

          <div className="flex items-center gap-2">
            <div className="bg-green border border-layer02 w-4 h-4" />
            <span>-</span>
            <p>Saldo positivo (lucro)</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-red border border-layer02 w-4 h-4" />
            <span>-</span>
            <p>Saldo negativo (prejuízo)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
