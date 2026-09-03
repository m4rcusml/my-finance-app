'use client';

import type {
  CivilDate,
  CreateFixedTransactionRequest,
  FixedTransaction,
  Money,
  OccurrenceWithTemplate,
  UpdateFixedTransactionRequest,
} from '@finance/contracts';
import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { errorMessage, fixedTransactionsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';
import { useToast } from '@/shared/ui/toast';

/**
 * Write hooks for recurring templates and occurrences.
 *
 * Toast + cache invalidation live inside the hooks so every caller — this
 * screen and the dashboard panel alike — gets the same behaviour. Callers still
 * receive the mutation object, so they can disable their submit button on
 * `isPending` and render `error` inline instead of relying on a toast that
 * auto-dismisses.
 */

/** Templates and their occurrence rows. */
function useInvalidateTemplates() {
  const queryClient = useQueryClient();
  const session = useSessionKey();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.fixedTransactions.all(session) }),
      // The dashboard renders `pendingOccurrences`, which a template change moves.
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(session) }),
    ]);
  }, [queryClient, session]);
}

/**
 * Confirming books a real transaction, which moves an account balance or a card
 * cycle, so those caches go too — otherwise the balance on screen silently lies
 * until the next reload.
 */
function useInvalidateAfterOccurrence() {
  const queryClient = useQueryClient();
  const session = useSessionKey();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.fixedTransactions.all(session) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all(session) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(session) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all(session) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.creditCards.all(session) }),
    ]);
  }, [queryClient, session]);
}

export interface UpdateFixedTransactionVariables {
  id: string;
  body: UpdateFixedTransactionRequest;
}

export interface FixedTransactionMutations {
  create: UseMutationResult<FixedTransaction, Error, CreateFixedTransactionRequest>;
  update: UseMutationResult<FixedTransaction, Error, UpdateFixedTransactionVariables>;
  archive: UseMutationResult<FixedTransaction, Error, string>;
  restore: UseMutationResult<FixedTransaction, Error, string>;
}

export function useFixedTransactionMutations(): FixedTransactionMutations {
  const invalidate = useInvalidateTemplates();
  const toast = useToast();

  const create = useMutation<FixedTransaction, Error, CreateFixedTransactionRequest>({
    mutationFn: (body) => fixedTransactionsApi.create(body),
    onSuccess: async (template) => {
      await invalidate();
      toast.success('Modelo criado', template.description ?? undefined);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const update = useMutation<FixedTransaction, Error, UpdateFixedTransactionVariables>({
    mutationFn: ({ id, body }) => fixedTransactionsApi.update(id, body),
    onSuccess: async () => {
      await invalidate();
      toast.success('Modelo atualizado', 'As ocorrências futuras passam a usar os novos dados.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const archive = useMutation<FixedTransaction, Error, string>({
    mutationFn: (id) => fixedTransactionsApi.archive(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Modelo arquivado', 'Nenhuma nova ocorrência será gerada. O histórico foi mantido.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const restore = useMutation<FixedTransaction, Error, string>({
    mutationFn: (id) => fixedTransactionsApi.restore(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Modelo reativado', 'As próximas ocorrências voltam a ser geradas.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return { create, update, archive, restore };
}

export interface ConfirmOccurrenceVariables {
  id: string;
  /** The day the money actually moved. Defaults server-side to the `dueDate`. */
  realDate?: CivilDate;
  /** Overrides the template amount for this period only. */
  value?: Money;
}

/**
 * Confirms one occurrence, which creates the linked transaction.
 *
 * `mutate({ id, realDate, value })`. A 409 means the occurrence is already
 * final (a second tab won the race, or it was confirmed elsewhere); the caller
 * shows the backend message, and the invalidation below pulls the true state
 * back down.
 */
export function useConfirmOccurrence(): UseMutationResult<
  OccurrenceWithTemplate,
  Error,
  ConfirmOccurrenceVariables
> {
  const invalidate = useInvalidateAfterOccurrence();
  const toast = useToast();

  return useMutation<OccurrenceWithTemplate, Error, ConfirmOccurrenceVariables>({
    mutationFn: ({ id, realDate, value }) => fixedTransactionsApi.confirmOccurrence(id, { realDate, value }),
    onSuccess: async () => {
      await invalidate();
      toast.success('Ocorrência confirmada', 'O lançamento vinculado foi criado.');
    },
    onError: async (error) => {
      // Refetch even on failure: a 409 means our copy of the row is stale.
      await invalidate();
      toast.error(errorMessage(error));
    },
  });
}

/**
 * Skips one occurrence. `mutate(occurrenceId)`.
 *
 * Skipping is final and creates no transaction; the period simply stops asking.
 */
export function useSkipOccurrence(): UseMutationResult<OccurrenceWithTemplate, Error, string> {
  const invalidate = useInvalidateAfterOccurrence();
  const toast = useToast();

  return useMutation<OccurrenceWithTemplate, Error, string>({
    mutationFn: (id) => fixedTransactionsApi.skipOccurrence(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Ocorrência pulada', 'Nenhum lançamento foi criado para este período.');
    },
    onError: async (error) => {
      await invalidate();
      toast.error(errorMessage(error));
    },
  });
}
