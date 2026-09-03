'use client';

import type { CivilDate, Money, OccurrenceWithTemplate } from '@finance/contracts';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useCallback } from 'react';
import { errorMessage, fixedTransactionsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';
import { useToast } from '@/shared/ui/toast';

/**
 * Confirming / skipping a recurring occurrence from the dashboard.
 *
 * These call `fixedTransactionsApi` directly rather than importing
 * `@/features/fixed-transactions/mutations`, which does not exist yet. If that
 * module lands, these two hooks can be replaced by re-exports — the invalidation
 * set below is what matters and is deliberately wider than the dashboard alone.
 *
 * Confirming an occurrence *creates a transaction*, which moves an account or a
 * card cycle. Invalidating only the dashboard would leave /accounts, /cartões
 * and /transactions showing pre-confirmation numbers until their next refetch.
 */

export interface ConfirmOccurrenceVariables {
  id: string;
  /** The day the money actually moved. Defaults server-side to the `dueDate`. */
  realDate?: CivilDate;
  /** Overrides the template amount for this period only. */
  value?: Money;
}

function useOccurrenceInvalidation(): () => Promise<void> {
  const sessionKey = useSessionKey();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(sessionKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.fixedTransactions.all(sessionKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all(sessionKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all(sessionKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.creditCards.all(sessionKey) }),
    ]);
  }, [queryClient, sessionKey]);
}

export function useConfirmOccurrence(): UseMutationResult<
  OccurrenceWithTemplate,
  unknown,
  ConfirmOccurrenceVariables
> {
  const invalidate = useOccurrenceInvalidation();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, realDate, value }: ConfirmOccurrenceVariables) =>
      fixedTransactionsApi.confirmOccurrence(id, { realDate, value }),
    onSuccess: async () => {
      await invalidate();
      toast.success('Recorrência confirmada', 'O lançamento foi criado.');
    },
    onError: (error) => {
      toast.error('Não foi possível confirmar', errorMessage(error));
    },
  });
}

export function useSkipOccurrence(): UseMutationResult<OccurrenceWithTemplate, unknown, { id: string }> {
  const invalidate = useOccurrenceInvalidation();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => fixedTransactionsApi.skipOccurrence(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Recorrência pulada', 'Nenhum lançamento foi criado para este período.');
    },
    onError: (error) => {
      toast.error('Não foi possível pular', errorMessage(error));
    },
  });
}
