import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type CreateAccountDto, accountsApi, UpdateAccountDto } from '@/shared/lib/api/accounts';
import { queryKeys } from '@/shared/lib/query/keys';

export function useCreateAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateAccountDto) => accountsApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all() });
    },
  });
}

export function useUpdateAccountMutation(accountId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateAccountDto) => accountsApi.update(accountId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.detail(accountId) })
    },
  });
}

export function useDeleteAccountMutation(accountId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => accountsApi.remove(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all() })
    },
  });
}