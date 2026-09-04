import type { InvestmentWithAsset, PaginatedResponse } from '@finance/contracts';
import { investmentsApi } from '@/shared/lib/api';
import { buildContributionSeries } from './contribution-series';
import { loadContributionInvestments } from './queries';

jest.mock('@/shared/lib/api', () => ({ investmentsApi: { list: jest.fn() } }));

function position(id: string, buyDate: string, investedAmount: number): InvestmentWithAsset {
  return {
    id,
    buyDate,
    investedAmount,
    marketAssetId: null,
    marketAsset: null,
    broker: 'Corretora',
    type: 'fixed_income',
    quantity: 1,
    buyPrice: investedAmount,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function page(data: InvestmentWithAsset[], current: number, total: number): PaginatedResponse<InvestmentWithAsset> {
  return {
    data,
    meta: {
      page: current,
      limit: 100,
      totalItems: total,
      totalPages: Math.ceil(total / 100),
      hasNextPage: current < Math.ceil(total / 100),
      hasPreviousPage: current > 1,
    },
  };
}

describe('histórico real de aportes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('mantém seis meses civis, cruza o ano e preenche meses sem compras com zero', () => {
    const result = buildContributionSeries(
      [
        position('outside', '2025-08-31', 500),
        position('last-year', '2025-12-31', 10.1),
        position('leap', '2026-02-28', 20),
        position('future', '2026-03-01', 900),
      ],
      '2026-02-01',
    );
    expect(result).toEqual([
      { month: '2025-09', amount: 0 },
      { month: '2025-10', amount: 0 },
      { month: '2025-11', amount: 0 },
      { month: '2025-12', amount: 10.1 },
      { month: '2026-01', amount: 0 },
      { month: '2026-02', amount: 20 },
    ]);
  });

  it('soma em centavos sem ruído de ponto flutuante', () => {
    const result = buildContributionSeries(
      [position('a', '2026-09-01', 0.1), position('b', '2026-09-02', 0.2)],
      '2026-09-04',
    );
    expect(result.at(-1)?.amount).toBe(0.3);
  });

  it('busca todas as páginas, incluindo posições após o centésimo registro', async () => {
    const first = Array.from({ length: 100 }, (_, index) => position(String(index), '2026-09-01', 1));
    const second = [position('100', '2026-09-02', 20)];
    jest
      .mocked(investmentsApi.list)
      .mockResolvedValueOnce(page(first, 1, 101))
      .mockResolvedValueOnce(page(second, 2, 101));
    const result = await loadContributionInvestments();
    expect(investmentsApi.list).toHaveBeenNthCalledWith(1, { page: 1, limit: 100 });
    expect(investmentsApi.list).toHaveBeenNthCalledWith(2, { page: 2, limit: 100 });
    expect(result).toHaveLength(101);
    expect(buildContributionSeries(result, '2026-09-04').at(-1)?.amount).toBe(120);
  });

  it('não entrega uma série parcial quando uma página falha', async () => {
    jest
      .mocked(investmentsApi.list)
      .mockResolvedValueOnce(page([position('1', '2026-09-01', 10)], 1, 101))
      .mockRejectedValueOnce(new Error('Conexão interrompida'));
    await expect(loadContributionInvestments()).rejects.toThrow('Conexão interrompida');
  });

  it('encerra depois da primeira resposta quando a carteira está vazia', async () => {
    jest.mocked(investmentsApi.list).mockResolvedValueOnce(page([], 1, 0));
    await expect(loadContributionInvestments()).resolves.toEqual([]);
    expect(investmentsApi.list).toHaveBeenCalledTimes(1);
  });
});
