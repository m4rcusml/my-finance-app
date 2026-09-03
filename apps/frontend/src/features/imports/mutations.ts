'use client';

import type {
  ConfirmImportRequest,
  ConfirmImportResponse,
  ImportOrigin,
  ImportPreviewResponse,
} from '@finance/contracts';
import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { importsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';

/** Analyses the file server-side. Writes nothing, so it invalidates nothing. */
export function usePreviewImportMutation(): UseMutationResult<
  ImportPreviewResponse,
  unknown,
  { file: File; origin: ImportOrigin }
> {
  return useMutation({
    mutationFn: ({ file, origin }) => importsApi.preview(file, origin),
  });
}

export interface ConfirmImportVariables {
  batchId: string;
  body: ConfirmImportRequest;
}

/**
 * Books the selected rows.
 *
 * This is the mutation with the widest blast radius in the app: it creates
 * transactions, which moves account balances, card cycle usage and every
 * dashboard total — so all of those caches are invalidated, not just the
 * import history.
 */
export function useConfirmImportMutation(): UseMutationResult<
  ConfirmImportResponse,
  unknown,
  ConfirmImportVariables
> {
  const s = useSessionKey();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, body }) => importsApi.confirm(batchId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.all(s) });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all(s) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(s) });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all(s) });
      queryClient.invalidateQueries({ queryKey: queryKeys.creditCards.all(s) });
    },
  });
}
