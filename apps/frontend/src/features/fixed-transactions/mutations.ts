import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fixedTransactionsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { CreateFixedTransactionDto, UpdateFixedTransactionDto } from '@/shared/lib/api/fixed-transactions';

export function useCreateFixedTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateFixedTransactionDto) => fixedTransactionsApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fixedTransactions.all() });
      // Fixed transactions might affect future dashboard values/forecasts?
      // Assuming they might affect dashboard if they generate occurrences immediately or if dashboard shows active fixed expenses.
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
  });
}

export function useUpdateFixedTransactionMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateFixedTransactionDto) => fixedTransactionsApi.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fixedTransactions.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.fixedTransactions.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
  });
}

export function useDeactivateFixedTransactionMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => fixedTransactionsApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fixedTransactions.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.fixedTransactions.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
  });
}

export function useConfirmOccurrenceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { id: string; realDate: string }) =>
      fixedTransactionsApi.confirmOccurrence(params.id, params.realDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fixedTransactions.all() });
      // Confirming an occurrence creates a real transaction? If so, we should invalidate transactions and accounts.
      // Based on typical logic, confirming creates a real transaction record or updates balance.
      // Let's assume it affects everything.
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
  });
}

export function useSkipOccurrenceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => fixedTransactionsApi.skipOccurrence(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fixedTransactions.all() });
    },
  });
}
