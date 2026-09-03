import type { Category, TransactionWithRelations } from '@finance/contracts';
import { categoryLabel, categoryOptions, moneyToInput, parseMoneyInput, transactionOrigin } from './helpers';

const categories: Category[] = [
  {
    id: 'income',
    name: 'Salário',
    type: 'income',
    isActive: true,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'expense',
    name: 'Mercado',
    type: 'expense',
    isActive: true,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'both',
    name: 'Ajuste',
    type: 'both',
    isActive: true,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('transaction helpers', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['1234,56', 1234.56],
    ['1234.56', 1234.56],
    ['0,009', 0.01],
  ])('converte entrada monetária %s', (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });

  it.each(['', 'abc', '-10', '1,2,3'])('recusa entrada monetária inválida %s', (input) => {
    expect(parseMoneyInput(input)).toBeNull();
  });

  it('mantém categorias compatíveis e a categoria legada em uma edição', () => {
    expect(categoryOptions(categories, 'income').map((category) => category.id)).toEqual(['income', 'both']);
    expect(categoryOptions(categories, 'income', 'expense').map((category) => category.id)).toEqual([
      'income',
      'expense',
      'both',
    ]);
  });

  it('usa os nomes denormalizados em vez dos UUIDs', () => {
    const transaction = {
      account: { id: 'account-id', name: 'Conta principal' },
      creditCard: null,
      category: { id: 'category-id', name: 'Moradia', type: 'expense' },
    } as TransactionWithRelations;

    expect(transactionOrigin(transaction)).toEqual({ kind: 'Conta', name: 'Conta principal' });
    expect(categoryLabel(transaction)).toBe('Moradia');
    expect(moneyToInput(1234.5)).toBe('1234,50');
  });
});
