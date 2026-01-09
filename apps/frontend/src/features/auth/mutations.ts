import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/shared/lib/api/auth';
import { useAuthStore } from '@/shared/stores/auth-store';

export function useLoginMutation() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (params: { email: string; password: string }) =>
      authApi.login(params.email, params.password),
    onSuccess: async (res) => {
      setAuth(res.access_token, null);

      const me = await authApi.me();
      useAuthStore.getState().setAuth(res.access_token, me);
    },
  });
}
