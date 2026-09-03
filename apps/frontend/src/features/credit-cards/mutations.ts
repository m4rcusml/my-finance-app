'use client';

import type { CreateCreditCardRequest, CreditCard, UpdateCreditCardRequest } from '@finance/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { creditCardsApi, errorMessage } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';
import { useToast } from '@/shared/ui/toast';

/**
 * Credit-card writes.
 *
 * `closingDay` is the one clearable field: send an explicit `null` to drop it
 * and align the cycle to the civil month. `undefined` would leave it untouched.
 */

function useCreditCardMutationDeps() {
  const queryClient = useQueryClient();
  const s = useSessionKey();
  const toast = useToast();

  /** Cards always; the dashboard because it embeds the cards and the credit totals. */
  const invalidate = async (alsoTransactions = false) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.creditCards.all(s) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(s) }),
      ...(alsoTransactions
        ? [queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all(s) })]
        : []),
    ]);
  };

  return { invalidate, toast };
}

export function useCreateCreditCardMutation() {
  const { invalidate, toast } = useCreditCardMutationDeps();

  return useMutation<CreditCard, unknown, CreateCreditCardRequest>({
    mutationFn: (body) => creditCardsApi.create(body),
    onSuccess: async (card) => {
      await invalidate();
      toast.success('Cartão criado', `“${card.name}” está disponível nos seletores.`);
    },
    onError: (error) => toast.error('Não foi possível criar o cartão', errorMessage(error)),
  });
}

export function useUpdateCreditCardMutation() {
  const { invalidate, toast } = useCreditCardMutationDeps();

  return useMutation<CreditCard, unknown, { id: string; body: UpdateCreditCardRequest }>({
    mutationFn: ({ id, body }) => creditCardsApi.update(id, body),
    onSuccess: async (card) => {
      await invalidate(true);
      toast.success('Cartão atualizado', `As alterações em “${card.name}” foram salvas.`);
    },
    onError: (error) => toast.error('Não foi possível salvar o cartão', errorMessage(error)),
  });
}

export function useArchiveCreditCardMutation() {
  const { invalidate, toast } = useCreditCardMutationDeps();

  return useMutation<CreditCard, unknown, string>({
    mutationFn: (id) => creditCardsApi.archive(id),
    onSuccess: async (card) => {
      await invalidate();
      toast.success('Cartão arquivado', `“${card.name}” saiu dos seletores; o histórico foi preservado.`);
    },
    onError: (error) => toast.error('Não foi possível arquivar o cartão', errorMessage(error)),
  });
}

export function useRestoreCreditCardMutation() {
  const { invalidate, toast } = useCreditCardMutationDeps();

  return useMutation<CreditCard, unknown, string>({
    mutationFn: (id) => creditCardsApi.restore(id),
    onSuccess: async (card) => {
      await invalidate();
      toast.success('Cartão reativado', `“${card.name}” voltou para os seletores.`);
    },
    onError: (error) => toast.error('Não foi possível reativar o cartão', errorMessage(error)),
  });
}

/**
 * Archive-or-delete: o cartão só é removido de verdade quando nenhum lançamento,
 * recorrência ou ocorrência aponta para ele. Caso contrário é arquivado.
 */
export function useDeleteCreditCardMutation() {
  const { invalidate, toast } = useCreditCardMutationDeps();

  return useMutation<void, unknown, string>({
    mutationFn: (id) => creditCardsApi.remove(id),
    onSuccess: async () => {
      await invalidate(true);
      toast.success('Cartão excluído', 'Se houver histórico vinculado, ele foi apenas arquivado.');
    },
    onError: (error) => toast.error('Não foi possível excluir o cartão', errorMessage(error)),
  });
}
