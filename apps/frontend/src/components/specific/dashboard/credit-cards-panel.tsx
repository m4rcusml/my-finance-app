import { useState } from 'react';
import { formatCurrency } from '@/shared/lib/utils';
import { CreateCreditCardModal } from '@/components/specific/modals/create-credit-card-modal';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CreditCard } from '@/shared/lib/api/credit-cards';

type CreditCardsPanelProps = {
  creditCards: CreditCard[];
};

export function CreditCardsPanel({ creditCards }: CreditCardsPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const totalCreditLimit = creditCards.reduce((sum, c) => sum + c.limitTotal, 0);
  const totalCreditUsed = creditCards.reduce((sum, c) => sum + c.usedAmount, 0);
  const totalCreditAvailable = creditCards.reduce((sum, c) => sum + c.availableAmount, 0);

  return (
    <>
      <div className="bg-layer01 rounded-4xl px-6 py-5">
        <div className="flex justify-between items-center">
          <h3 className="text-md">Seus cartões</h3>

          <div className="flex gap-2">
            <Button tone="layer02" size="regular" onClick={() => setIsModalOpen(true)}>
              Novo cartão
            </Button>
            <Link href="/credit-cards">
              <Button tone="layer02" size="regular" rightIcon="ArrowAngularTopRightOutlined">
                Ver mais
              </Button>
            </Link>
          </div>
        </div>

        {creditCards.length > 0 && (
          <div className="mt-3 mb-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>Total utilizado</span>
              <span>Limite total</span>
            </div>
            <div className="w-full bg-layer02 rounded-full h-2 mb-1">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{
                  width: `${totalCreditLimit > 0 ? Math.min((totalCreditUsed / totalCreditLimit) * 100, 100) : 0}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span className="text-foreground">{formatCurrency(totalCreditUsed)}</span>
              <span className="text-muted-foreground">{formatCurrency(totalCreditLimit)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Disponível total:{' '}
              <span className="text-green-500 font-medium">{formatCurrency(totalCreditAvailable)}</span>
            </p>
          </div>
        )}

        <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
          {creditCards.length === 0 ? (
            <div className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-foreground/10 bg-layer02/50 py-8 text-center text-muted-foreground">
              <p className="text-sm">Nenhum cartão encontrado</p>
              <Button size="small" tone="layer01" onClick={() => setIsModalOpen(true)}>
                Criar primeiro cartão
              </Button>
            </div>
          ) : (
            creditCards.slice(0, 3).map((card) => (
              <div
                key={card.id}
                className="rounded-2xl border border-foreground/10 bg-layer02 p-4 text-muted-foreground min-w-[200px]"
              >
                <div className="flex items-center gap-3">
                  <Button leftIcon="CreditCardMultipleOutlined" tone="layer01" />
                  <div>
                    <p className="text-xs text-muted-foreground">{card.institution}</p>
                    <p className="text-md font-medium text-foreground">{card.name}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="w-full bg-layer01 rounded-full h-1.5 mb-1">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{
                        width: `${card.limitTotal > 0 ? Math.min((card.usedAmount / card.limitTotal) * 100, 100) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{formatCurrency(card.usedAmount)}</span>
                    <span className="text-muted-foreground">{formatCurrency(card.limitTotal)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <CreateCreditCardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
