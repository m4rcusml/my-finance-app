import { useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { CreateCategoryDto, UpdateCategoryDto } from '@/shared/lib/api/categories';

export function useCreateCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateCategoryDto) => categoriesApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all() });
    },
  });
}

export function useUpdateCategoryMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateCategoryDto) => categoriesApi.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.detail(id) });
    },
  });
}

export function useDeleteCategoryMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => categoriesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all() });
    },
  });
}
