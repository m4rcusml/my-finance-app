import { formatCurrency } from '@/features/dashboard/utils';
import { Button } from '@/components/ui/button';
import useEmblaCarousel from 'embla-carousel-react';

import { useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Transaction } from '@/shared/lib/api/dashboard';

type FixedTransactionsPanelProps = {
  transactions?: Transaction[];
};

export function FixedTransactionsPanel({ transactions = [] }: FixedTransactionsPanelProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: 'center' });

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-layer02 flex justify-between items-center px-4 py-2 rounded-4xl">
        <Button tone="layer02" leftIcon="ArrowLeftOutlined" onClick={scrollPrev} disabled={transactions.length === 0} />

        <span className="text-md">Transações fixas</span>

        <Button
          tone="layer02"
          rightIcon="ArrowRightOutlined"
          onClick={scrollNext}
          disabled={transactions.length === 0}
        />
      </div>

      <div className="embla overflow-hidden" ref={emblaRef}>
        <div className="embla__container flex">
          {transactions.length > 0 ? (
            transactions.map((transaction) => (
              <div key={transaction.id} className="embla__slide flex-[0_0_100%] min-w-0">
                <div className="m-auto flex items-center rounded-2xl border border-foreground/10 bg-layer01 px-4 py-4 w-4/5">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label tone="layer02">
                        {typeof transaction.category === 'object' ? transaction.category.name : 'Sem categoria'}
                      </Label>
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">{transaction.description}</div>
                    <div className="mt-1 text-md font-semibold text-foreground">
                      {formatCurrency(Number(transaction.value))}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {transaction.referenceDay ? `Dia ${transaction.referenceDay}` : transaction.due}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-2">
                    <Button size="large">Marcar como concluida</Button>
                    <Button size="large" tone="layer02">
                      Marcar como nao concluida
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex-[0_0_100%] min-w-0">
              <div className="m-auto flex items-center justify-center rounded-2xl border border-dashed border-foreground/10 bg-layer02/50 px-4 py-8 w-4/5">
                <span className="text-muted-foreground text-sm">Nenhuma transação fixa encontrada</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
