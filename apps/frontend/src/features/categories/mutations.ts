'use client';

import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from '@finance/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, errorMessage } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';
import { useToast } from '@/shared/ui/toast';

function useCategoryMutationDependencies() {
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();
  const toast = useToast();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all(sessionKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all(sessionKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.fixedTransactions.all(sessionKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(sessionKey) }),
    ]);
  };

  return { invalidate, toast };
}

export function useCreateCategoryMutation() {
  const { invalidate, toast } = useCategoryMutationDependencies();

  return useMutation<Category, unknown, CreateCategoryRequest>({
    mutationFn: (body) => categoriesApi.create(body),
    onSuccess: async (category) => {
      await invalidate();
      toast.success('Categoria criada', `“${category.name}” está disponível nos lançamentos.`);
    },
    onError: (error) => toast.error('Não foi possível criar a categoria', errorMessage(error)),
  });
}

export function useUpdateCategoryMutation() {
  const { invalidate, toast } = useCategoryMutationDependencies();

  return useMutation<Category, unknown, { id: string; body: UpdateCategoryRequest }>({
    mutationFn: ({ id, body }) => categoriesApi.update(id, body),
    onSuccess: async (category) => {
      await invalidate();
      toast.success('Categoria atualizada', `As alterações em “${category.name}” foram salvas.`);
    },
    onError: (error) => toast.error('Não foi possível salvar a categoria', errorMessage(error)),
  });
}

export function useArchiveCategoryMutation() {
  const { invalidate, toast } = useCategoryMutationDependencies();

  return useMutation<Category, unknown, string>({
    mutationFn: (id) => categoriesApi.archive(id),
    onSuccess: async (category) => {
      await invalidate();
      toast.success('Categoria arquivada', `“${category.name}” saiu dos seletores; o histórico foi preservado.`);
    },
    onError: (error) => toast.error('Não foi possível arquivar a categoria', errorMessage(error)),
  });
}

export function useRestoreCategoryMutation() {
  const { invalidate, toast } = useCategoryMutationDependencies();

  return useMutation<Category, unknown, string>({
    mutationFn: (id) => categoriesApi.restore(id),
    onSuccess: async (category) => {
      await invalidate();
      toast.success('Categoria reativada', `“${category.name}” voltou para os seletores.`);
    },
    onError: (error) => toast.error('Não foi possível reativar a categoria', errorMessage(error)),
  });
}

export function useDeleteCategoryMutation() {
  const { invalidate, toast } = useCategoryMutationDependencies();

  return useMutation<void, unknown, string>({
    mutationFn: (id) => categoriesApi.remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Categoria excluída', 'Se houver histórico vinculado, ela foi apenas arquivada.');
    },
    onError: (error) => toast.error('Não foi possível excluir a categoria', errorMessage(error)),
  });
}
