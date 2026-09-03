'use client';

import type {
  CreateInvestmentRequest,
  CreateMarketAssetRequest,
  Investment,
  MarketAsset,
  UpdateInvestmentRequest,
} from '@finance/contracts';
import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { investmentsApi, marketAssetsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';
import { useToast } from '@/shared/ui/toast';

/**
 * Investment mutations.
 *
 * Each one invalidates the whole `investments` subtree (list *and* summary share
 * that prefix) plus the dashboard, whose `portfolioInvested` total is derived
 * from the portfolio. Errors are deliberately NOT swallowed here: the calling
 * form awaits the promise so it can keep itself open and show the message
 * inline, which a toast alone would not do.
 */

export function useCreateInvestmentMutation(): UseMutationResult<Investment, unknown, CreateInvestmentRequest> {
  const s = useSessionKey();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (body: CreateInvestmentRequest) => investmentsApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.investments.all(s) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(s) });
      toast.success('Investimento registrado.');
    },
  });
}

export function useUpdateInvestmentMutation(): UseMutationResult<
  Investment,
  unknown,
  { id: string; body: UpdateInvestmentRequest }
> {
  const s = useSessionKey();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateInvestmentRequest }) => investmentsApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.investments.all(s) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(s) });
      toast.success('Investimento atualizado.');
    },
  });
}

export function useDeleteInvestmentMutation(): UseMutationResult<void, unknown, string> {
  const s = useSessionKey();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => investmentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.investments.all(s) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(s) });
      toast.success('Investimento excluído.');
    },
  });
}

/**
 * Registering an asset without leaving the page. The market-asset list is what
 * the "ativo" selector reads, so it is invalidated and the new asset appears in
 * the open dialog as soon as the refetch lands.
 */
export function useCreateMarketAssetMutation(): UseMutationResult<MarketAsset, unknown, CreateMarketAssetRequest> {
  const s = useSessionKey();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (body: CreateMarketAssetRequest) => marketAssetsApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketAssets.all(s) });
      queryClient.invalidateQueries({ queryKey: queryKeys.investments.all(s) });
      toast.success('Ativo cadastrado.');
    },
  });
}
