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

export function useUpdateAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateAccountDto }) => accountsApi.update(id, dto),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.detail(id) })
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