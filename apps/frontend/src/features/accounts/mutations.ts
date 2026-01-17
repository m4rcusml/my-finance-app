import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type CreateAccountDto, accountsApi, UpdateAccountDto } from '@/shared/lib/api/accounts';

export function useCreateAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateAccountDto) => accountsApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateAccountMutation(accountId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateAccountDto) => accountsApi.update(accountId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  });
}

export function useDeleteAccountMutation(accountId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => accountsApi.remove(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  });
}