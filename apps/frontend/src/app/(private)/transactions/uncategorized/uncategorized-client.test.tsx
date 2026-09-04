import { buildPaginatedResponse, type TransactionWithRelations } from '@finance/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UncategorizedClient } from './uncategorized-client';

const mockUpdate = jest.fn();
const mockList = jest.fn();
const mockToast = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/features/transactions/queries', () => ({
  useUncategorizedQuery: (filters: unknown) => mockList(filters),
}));
jest.mock('@/features/transactions/mutations', () => ({
  useTransactionMutations: () => ({ update: { mutateAsync: mockUpdate, isPending: false } }),
}));
jest.mock('@/features/categories/queries', () => ({
  useActiveCategoriesQuery: () => ({
    categories: [{ id: 'category-1', name: 'Mercado', type: 'expense', isActive: true, color: '#a78bfa' }],
    isPending: false,
    error: null,
    query: { refetch: jest.fn() },
  }),
}));
jest.mock('@/shared/ui/toast', () => ({ useToast: () => ({ success: mockToast }) }));

const items: TransactionWithRelations[] = Array.from({ length: 21 }, (_, index) => ({
  id: `transaction-${index + 1}`,
  description: `Compra ${index + 1}`,
  type: 'expense',
  value: 10,
  date: '2026-09-01',
  accountId: 'account-1',
  creditCardId: null,
  categoryId: null,
  source: 'manual',
  externalId: null,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
  account: { id: 'account-1', name: 'Principal' },
  creditCard: null,
  category: null,
}));

beforeEach(() => {
  mockUpdate.mockReset();
  mockToast.mockReset();
  mockList.mockReset();
  mockList.mockImplementation(({ page, limit }: { page: number; limit: number }) => ({
    data: buildPaginatedResponse(items.slice((page - 1) * limit, page * limit), items.length, page, limit),
    isSuccess: true,
    isPending: false,
    isError: false,
    isFetching: false,
  }));
});

it('navigates across server pages and returns to the preceding item', async () => {
  const user = userEvent.setup();
  render(<UncategorizedClient embedded />);
  for (let index = 0; index < 20; index += 1) await user.click(screen.getByRole('button', { name: 'Próxima' }));
  expect(mockList).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
  expect(screen.getByRole('heading', { name: 'Compra 21' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Anterior' }));
  expect(screen.getByRole('heading', { name: 'Compra 20' })).toBeInTheDocument();
});

it('skipping does not mutate; categorizing updates only the selected transaction', async () => {
  const user = userEvent.setup();
  mockUpdate.mockResolvedValue({});
  render(<UncategorizedClient embedded />);
  await user.click(screen.getByRole('button', { name: 'Ignorar por agora' }));
  expect(mockUpdate).not.toHaveBeenCalled();
  await user.click(screen.getByRole('radio', { name: 'Mercado' }));
  await user.click(screen.getByRole('button', { name: 'Categorizar e ir para a próxima' }));
  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith({ id: 'transaction-2', body: { categoryId: 'category-1' } }),
  );
  expect(mockToast).toHaveBeenCalledWith('Transação categorizada.');
});
