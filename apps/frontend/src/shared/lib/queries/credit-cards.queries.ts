import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/lib/query/keys';
import { creditCardsApi } from '@/shared/lib/api/credit-cards';

export function useCreditCardsQuery() {
  return useQuery({
    queryKey: queryKeys.creditCards.all(),
    queryFn: () => creditCardsApi.list(),
  });
}

export function useCreditCardQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.creditCards.detail(id),
    queryFn: () => creditCardsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateCreditCardMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creditCardsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.creditCards.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
  });
}

export function useUpdateCreditCardMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Parameters<typeof creditCardsApi.update>[1] }) =>
      creditCardsApi.update(id, dto),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.creditCards.all() });
      qc.invalidateQueries({ queryKey: queryKeys.creditCards.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
  });
}

export function useDeleteCreditCardMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creditCardsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.creditCards.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
  });
}
