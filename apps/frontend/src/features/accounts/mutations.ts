import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type CreateAccountDto, accountsApi } from '@/shared/lib/api/accounts';

export function useCreateAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateAccountDto) => accountsApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
