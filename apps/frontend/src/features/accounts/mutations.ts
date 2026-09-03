'use client';

import type { Account, CreateAccountRequest, UpdateAccountRequest } from '@finance/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsApi, errorMessage } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';
import { useToast } from '@/shared/ui/toast';

/**
 * Account writes.
 *
 * Each hook owns its own cache invalidation and its own toast, so no caller can
 * forget them. Callers still get the rejection: a form must stay open with the
 * message visible, which the hook cannot do on the caller's behalf.
 */

function useAccountMutationDeps() {
  const queryClient = useQueryClient();
  const s = useSessionKey();
  const toast = useToast();

  /** Accounts always; the dashboard because it embeds accounts and cash totals. */
  const invalidate = async (alsoTransactions = false) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all(s) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(s) }),
      ...(alsoTransactions
        ? [queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all(s) })]
        : []),
    ]);
  };

  return { invalidate, toast };
}

export function useCreateAccountMutation() {
  const { invalidate, toast } = useAccountMutationDeps();

  return useMutation<Account, unknown, CreateAccountRequest>({
    mutationFn: (body) => accountsApi.create(body),
    onSuccess: async (account) => {
      await invalidate();
      toast.success('Conta criada', `“${account.name}” está disponível nos seletores.`);
    },
    onError: (error) => toast.error('Não foi possível criar a conta', errorMessage(error)),
  });
}

export function useUpdateAccountMutation() {
  const { invalidate, toast } = useAccountMutationDeps();

  return useMutation<Account, unknown, { id: string; body: UpdateAccountRequest }>({
    mutationFn: ({ id, body }) => accountsApi.update(id, body),
    onSuccess: async (account) => {
      await invalidate(true);
      toast.success('Conta atualizada', `As alterações em “${account.name}” foram salvas.`);
    },
    onError: (error) => toast.error('Não foi possível salvar a conta', errorMessage(error)),
  });
}

export function useArchiveAccountMutation() {
  const { invalidate, toast } = useAccountMutationDeps();

  return useMutation<Account, unknown, string>({
    mutationFn: (id) => accountsApi.archive(id),
    onSuccess: async (account) => {
      await invalidate();
      toast.success('Conta arquivada', `“${account.name}” saiu dos seletores; o histórico foi preservado.`);
    },
    onError: (error) => toast.error('Não foi possível arquivar a conta', errorMessage(error)),
  });
}

export function useRestoreAccountMutation() {
  const { invalidate, toast } = useAccountMutationDeps();

  return useMutation<Account, unknown, string>({
    mutationFn: (id) => accountsApi.restore(id),
    onSuccess: async (account) => {
      await invalidate();
      toast.success('Conta reativada', `“${account.name}” voltou para os seletores.`);
    },
    onError: (error) => toast.error('Não foi possível reativar a conta', errorMessage(error)),
  });
}

/**
 * The API is archive-or-delete: a conta só é removida de verdade quando não há
 * nenhum lançamento, recorrência, ocorrência ou meta apontando para ela. Caso
 * contrário ela é arquivada e o histórico continua legível.
 */
export function useDeleteAccountMutation() {
  const { invalidate, toast } = useAccountMutationDeps();

  return useMutation<void, unknown, string>({
    mutationFn: (id) => accountsApi.remove(id),
    onSuccess: async () => {
      await invalidate(true);
      toast.success('Conta excluída', 'Se houver histórico vinculado, ela foi apenas arquivada.');
    },
    onError: (error) => toast.error('Não foi possível excluir a conta', errorMessage(error)),
  });
}
