'use client';

import type {
  CreateTransactionRequest,
  TransactionWithRelations,
  UpdateTransactionRequest,
} from '@finance/contracts';
import { useMutation, type UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { errorMessage, transactionsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';
import { useToast } from '@/shared/ui/toast';

/**
 * Transaction writes.
 *
 * Every write invalidates the transaction lists AND everything a transaction
 * moves: the dashboard totals, the account balances and the credit-card cycle
 * usage. Skipping those is why a new expense used to leave a stale balance on
 * screen until a hard reload.
 *
 * Errors are surfaced twice on purpose — a toast for the moment it happens and
 * the rejected promise for the caller, which keeps the form open with the
 * message rendered inline. A toast alone would auto-dismiss the only copy.
 */

export interface UpdateTransactionVariables {
  id: string;
  body: UpdateTransactionRequest;
}

export interface TransactionMutations {
  create: UseMutationResult<TransactionWithRelations, unknown, CreateTransactionRequest>;
  update: UseMutationResult<TransactionWithRelations, unknown, UpdateTransactionVariables>;
  remove: UseMutationResult<void, unknown, string>;
  /** True while any of the three is in flight — for disabling submit buttons. */
  isBusy: boolean;
}

export function useTransactionMutations(): TransactionMutations {
  const s = useSessionKey();
  const queryClient = useQueryClient();
  const toast = useToast();

  const invalidateAffected = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all(s) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(s) }),
      // A transaction changes an account balance or a card's cycle usage.
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all(s) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.creditCards.all(s) }),
    ]);
  }, [queryClient, s]);

  const create = useMutation<TransactionWithRelations, unknown, CreateTransactionRequest>({
    mutationFn: (body) => transactionsApi.create(body),
    onSuccess: async () => {
      await invalidateAffected();
      toast.success('Transação criada.');
    },
    onError: (error) => toast.error('Não foi possível criar a transação', errorMessage(error)),
  });

  const update = useMutation<TransactionWithRelations, unknown, UpdateTransactionVariables>({
    mutationFn: ({ id, body }) => transactionsApi.update(id, body),
    onSuccess: async () => {
      await invalidateAffected();
    },
    onError: (error) => toast.error('Não foi possível salvar a transação', errorMessage(error)),
  });

  const remove = useMutation<void, unknown, string>({
    mutationFn: (id) => transactionsApi.remove(id),
    onSuccess: async () => {
      await invalidateAffected();
      toast.success('Transação excluída.');
    },
    // A 409 here means the row is tied to a confirmed recurrence. `errorMessage`
    // returns the backend's own pt-BR explanation, which is far more useful than
    // a generic "falhou", so it is what the user reads.
    onError: (error) => toast.error('Não foi possível excluir a transação', errorMessage(error)),
  });

  return {
    create,
    update,
    remove,
    isBusy: create.isPending || update.isPending || remove.isPending,
  };
}
