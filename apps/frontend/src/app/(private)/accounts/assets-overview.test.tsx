import type { Account, CreditCard, DashboardOverview, PaginatedResponse } from '@finance/contracts';
import type { UseQueryResult } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAccountsQuery } from '@/features/accounts/queries';
import { useCreditCardsQuery } from '@/features/credit-cards/queries';
import { useDashboardQuery } from '@/features/dashboard/queries';
import { AssetsOverview, AssetsSummary, CreditCardPreview } from './assets-overview';

jest.mock('@/features/accounts/queries', () => ({ useAccountsQuery: jest.fn() }));
jest.mock('@/features/credit-cards/queries', () => ({ useCreditCardsQuery: jest.fn() }));
jest.mock('@/features/dashboard/queries', () => ({ useDashboardQuery: jest.fn() }));

function success<T>(data: T): UseQueryResult<T> {
  return {
    data,
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: jest.fn(),
  } as unknown as UseQueryResult<T>;
}
function empty<T>(): PaginatedResponse<T> {
  return {
    data: [],
    meta: { page: 1, limit: 3, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false },
  };
}
const card: CreditCard = {
  id: 'card',
  name: 'Cartão principal',
  institution: 'Banco',
  limitTotal: 1000,
  closingDay: 31,
  cycleUsedAmount: 1200,
  availableAmount: -200,
  currentCycle: { start: '2024-02-29', end: '2024-03-30' },
  isActive: true,
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
};

describe('visão geral de contas e cartões', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAccountsQuery).mockReturnValue(success(empty<Account>()));
    jest.mocked(useCreditCardsQuery).mockReturnValue(success(empty<CreditCard>()));
  });

  it('oferece criação de conta e cartão e acesso às gestões quando ainda está vazia', async () => {
    const user = userEvent.setup();
    const onAddAccount = jest.fn();
    const onAddCard = jest.fn();
    render(
      <AssetsOverview
        onAddAccount={onAddAccount}
        onAddCard={onAddCard}
        onEditAccount={jest.fn()}
        onEditCard={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Nova conta' }));
    await user.click(screen.getByRole('button', { name: 'Novo cartão' }));
    expect(onAddAccount).toHaveBeenCalledTimes(1);
    expect(onAddCard).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/accounts?view=accounts');
    expect(screen.getByRole('link', { name: 'Gerenciar cartões' })).toHaveAttribute('href', '/accounts?view=cards');
  });

  it('usa os totais agregados da API e mantém contas de investimento fora do saldo em caixa', () => {
    jest.mocked(useDashboardQuery).mockReturnValue(
      success({
        totals: {
          netBalance: 7000,
          investedAccountBalance: 5000,
          totalCreditAvailable: 2300,
          totalCreditUsedThisCycle: 1700,
        },
      } as DashboardOverview),
    );
    render(<AssetsSummary />);
    expect(screen.getByText(/R\$\s7\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s2\.300,00/)).toBeInTheDocument();
    expect(screen.queryByText(/R\$\s12\.000,00/)).not.toBeInTheDocument();
  });

  it('mostra falha com retry em vez de afirmar que não existem contas', async () => {
    const refetch = jest.fn();
    jest.mocked(useAccountsQuery).mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error('Falha de conexão'),
      refetch,
    } as unknown as ReturnType<typeof useAccountsQuery>);
    render(
      <AssetsOverview
        onAddAccount={jest.fn()}
        onAddCard={jest.fn()}
        onEditAccount={jest.fn()}
        onEditCard={jest.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Falha de conexão');
    expect(screen.queryByText('Adicione sua primeira conta')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('preserva o saldo negativo de limite e apresenta o ciclo civil calculado pela API', () => {
    render(<CreditCardPreview card={card} />);
    expect(screen.getByText(/-R\$\s200,00/)).toBeInTheDocument();
    expect(screen.getByText(/ciclo até 30\/03\/2024/)).toBeInTheDocument();
    expect(screen.queryByText(/vence dia/)).not.toBeInTheDocument();
  });
});
