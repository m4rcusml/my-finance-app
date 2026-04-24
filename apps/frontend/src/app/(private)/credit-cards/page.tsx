'use client';

import { useState } from 'react';
import { useCreditCardsQuery, useDeleteCreditCardMutation } from '@/shared/lib/queries/credit-cards.queries';
import { CreateCreditCardModal } from '@/components/specific/modals/create-credit-card-modal';
import { EditCreditCardModal } from '@/components/specific/modals/edit-credit-card-modal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { formatCurrency } from '@/shared/lib/utils';
import { CreditCard } from '@/shared/lib/api/credit-cards';

export default function CreditCardsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const { data: creditCards, isLoading } = useCreditCardsQuery();
  const deleteMutation = useDeleteCreditCardMutation();

  function handleDelete(card: CreditCard) {
    if (window.confirm(`Tem certeza que deseja excluir o cartão "${card.name}"?`)) {
      deleteMutation.mutate(card.id);
    }
  }

  return (
    <main className="flex-1 flex flex-col space-y-6 h-full p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Cartões de Crédito</h2>
          <p className="text-muted-foreground">Gerencie seus cartões e limites.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setIsModalOpen(true)}>Novo Cartão</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-48 rounded-xl bg-layer02 animate-pulse" />)
        ) : creditCards && creditCards.length > 0 ? (
          creditCards.map((card) => (
            <div
              key={card.id}
              className="rounded-xl border border-foreground/10 bg-layer01 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between space-y-0 pb-2">
                <div className="font-medium text-sm text-muted-foreground">{card.institution}</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCard(card)}
                    className="p-2 transition-colors hover:text-foreground text-muted-foreground"
                  >
                    <Icon name="Pencil1Outlined" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(card)}
                    className="p-2 transition-colors hover:text-red text-muted-foreground"
                  >
                    <Icon name="Trash3Outlined" className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xl font-bold text-foreground">{card.name}</div>
                {card.closingDay ? (
                  <p className="text-xs text-muted-foreground uppercase mt-1">Fecha dia {card.closingDay}</p>
                ) : (
                  <p className="text-xs text-muted-foreground uppercase mt-1">Sem dia de fechamento</p>
                )}
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-muted-foreground mb-1">
                    <span>Utilizado</span>
                    <span>Limite</span>
                  </div>
                  <div className="w-full bg-layer02 rounded-full h-2.5 mb-2">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min((card.usedAmount / card.limitTotal) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-foreground">{formatCurrency(card.usedAmount)}</span>
                    <span className="text-muted-foreground">{formatCurrency(card.limitTotal)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Disponível:{' '}
                    <span className="text-green-500 font-medium">{formatCurrency(card.availableAmount)}</span>
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full flex h-[450px] shrink-0 items-center justify-center rounded-md border border-dashed border-foreground/20">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
              <div className="p-4 bg-layer02 rounded-full mb-4">
                <Icon name="CreditCardMultipleOutlined" className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">Nenhum cartão cadastrado</h3>
              <p className="mb-4 mt-2 text-sm text-muted-foreground">
                Você ainda não tem nenhum cartão de crédito cadastrado. Adicione um para começar.
              </p>
              <Button onClick={() => setIsModalOpen(true)}>Adicionar Cartão</Button>
            </div>
          </div>
        )}
      </div>

      <CreateCreditCardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <EditCreditCardModal isOpen={!!editingCard} onClose={() => setEditingCard(null)} card={editingCard} />
    </main>
  );
}
