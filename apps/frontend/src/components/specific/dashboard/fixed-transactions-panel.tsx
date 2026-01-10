import { formatCurrency } from '@/features/dashboard/utils';
import { sampleFixedTransactions } from '@/features/dashboard/sample-data';
import { Button } from '@/components/ui/button';
import useEmblaCarousel from 'embla-carousel-react';

export function FixedTransactionsPanel() {
  const [emblaRef] = useEmblaCarousel();

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-layer02 flex justify-between items-center px-4 py-2 rounded-4xl">
        <Button tone="layer02" leftIcon="ArrowLeftOutlined" />

        <span className="text-md">Transações fixas - [[Colocar mês e ano]]</span>

        <Button tone="layer02" rightIcon="ArrowRightOutlined" />
      </div>

      <div className="embla" ref={emblaRef}>
        <div className="embla__container">
          <div className="flex gap-4">
            {sampleFixedTransactions.map((transaction) => (
              <div key={transaction.id} className="embla__slide">
                <div className="m-auto flex items-center rounded-2xl border border-foreground/10 bg-layer01 px-4 py-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full text-xs bg-green/20 px-2 py-1 text-green">Receita</span>
                      <span className="rounded-full text-xs bg-layer01 px-2 py-1">{transaction.category}</span>
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">{transaction.title}</div>
                    <div className="mt-1 text-md font-semibold text-foreground">
                      {formatCurrency(transaction.amount)}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{transaction.due}</div>
                  </div>

                  <div className="flex-1 flex flex-col gap-2">
                    <Button size="large">Marcar como concluida</Button>
                    <Button size="large" tone="layer02">
                      Marcar como nao concluida
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
