import type { TransactionWithRelations } from '@finance/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionFormDialog } from './transaction-form-dialog';

const mockUpdate = jest.fn();
const mockCreate = jest.fn();

jest.mock('@/features/transactions/references', () => ({
  useTransactionReferences: () => ({
    accounts: [{ id: 'account-1', name: 'Conta principal' }],
    creditCards: [{ id: 'card-1', name: 'Cartão principal' }],
    categories: [
      {
        id: 'category-1',
        name: 'Mercado',
        type: 'expense',
        isActive: true,
        archivedAt: null,
      },
    ],
    isPending: false,
    isError: false,
  }),
}));

jest.mock('@/features/transactions/mutations', () => ({
  useTransactionMutations: () => ({
    create: { mutateAsync: mockCreate, isPending: false },
    update: { mutateAsync: mockUpdate, isPending: false },
  }),
}));

jest.mock('@/shared/ui/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn() }),
}));

const transaction: TransactionWithRelations = {
  id: 'transaction-1',
  type: 'expense',
  value: 89.9,
  date: '2026-03-10',
  accountId: 'account-1',
  creditCardId: null,
  categoryId: 'category-1',
  description: 'Supermercado',
  source: 'manual',
  externalId: null,
  createdAt: '2026-03-10T12:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
  account: { id: 'account-1', name: 'Conta principal' },
  creditCard: null,
  category: { id: 'category-1', name: 'Mercado', type: 'expense' },
};

describe('TransactionFormDialog', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(transaction);
  });

  it('troca conta por cartão e limpa a conta e a categoria explicitamente', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<TransactionFormDialog transaction={transaction} onClose={onClose} />);

    await user.click(screen.getByRole('radio', { name: 'Cartão' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cartão (obrigatório)' }), 'card-1');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Categoria' }), '');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        id: 'transaction-1',
        body: {
          type: 'expense',
          value: 89.9,
          date: '2026-03-10',
          accountId: null,
          creditCardId: 'card-1',
          categoryId: null,
          description: 'Supermercado',
        },
      });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
