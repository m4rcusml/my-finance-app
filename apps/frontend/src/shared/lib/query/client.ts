import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/lib/api/errors';

/**
 * A fresh client per session. Never a module singleton: that is what let one
 * user's cached rows survive a logout and reappear for the next one.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Never retry a client error — a 401/403/404/409 will not fix itself,
          // and retrying just delays the error state the user needs to see.
          if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
