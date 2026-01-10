// import { monthLabels } from '@/features/dashboard/utils';
import { sampleMonthlyNet } from '@/features/dashboard/sample-data';
import { Button } from '@/components/ui/button';

type AnnualBalanceProps = {
  monthlyNet?: number[];
};

export function AnnualBalance({ monthlyNet = sampleMonthlyNet }: AnnualBalanceProps) {
  const _maxValue = Math.max(...monthlyNet.map((value) => Math.abs(value)), 1);

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-layer01 flex justify-between items-center px-4 py-2 rounded-4xl">
        <Button tone="layer01" leftIcon="ArrowLeftOutlined" />

        <span className="text-md">Balanço anual</span>

        <Button tone="layer01" rightIcon="ArrowRightOutlined" />
      </div>

      <div className="flex-1">{/* gráficos */}</div>

      <div className="bg-layer01 rounded-4xl overflow-hidden">
        <div className="bg-layer02 flex items-center px-4 py-2">
          <span className="flex-1 text-center">Jan</span>
          <span className="flex-1 text-center">Fev</span>
          <span className="flex-1 text-center">Mar</span>
          <span className="flex-1 text-center">Abr</span>
          <span className="flex-1 text-center">Mai</span>
          <span className="flex-1 text-center">Jun</span>
          <span className="flex-1 text-center">Jul</span>
          <span className="flex-1 text-center">Ago</span>
          <span className="flex-1 text-center">Set</span>
          <span className="flex-1 text-center">Out</span>
          <span className="flex-1 text-center">Nov</span>
          <span className="flex-1 text-center">Dez</span>
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
