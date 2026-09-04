import type { Goal } from '@finance/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { goalsApi } from '@/shared/lib/api';
import { useGoalsSummaryQuery } from './queries';

jest.mock('@/shared/session/session-provider', () => ({ useSessionKey: () => 'user-1' }));
jest.mock('@/shared/lib/api', () => ({ goalsApi: { list: jest.fn() } }));

it('inclui todas as páginas no resumo sem truncar metas após o limite de 100', async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => ({
    id: `goal-${index}`,
    targetAmount: 100,
    progress: 0.5,
  }));
  const lastGoal = { id: 'goal-last', targetAmount: 500, progress: 1 };
  jest
    .mocked(goalsApi.list)
    .mockResolvedValueOnce({
      data: firstPage as Goal[],
      meta: { page: 1, limit: 100, totalItems: 101, totalPages: 2, hasNextPage: true, hasPreviousPage: false },
    })
    .mockResolvedValueOnce({
      data: [lastGoal] as Goal[],
      meta: { page: 2, limit: 100, totalItems: 101, totalPages: 2, hasNextPage: false, hasPreviousPage: true },
    });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useGoalsSummaryQuery(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(101);
  expect(result.current.data?.at(-1)).toEqual(lastGoal);
  expect(goalsApi.list).toHaveBeenNthCalledWith(2, { page: 2, limit: 100 });
  unmount();
  client.clear();
});
