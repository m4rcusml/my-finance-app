import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from '../accounts/accounts.service';
import { CreditCardsService } from '../credit-cards/credit-cards.service';
import { FixedTransactionsService } from '../fixed-transactions/fixed-transactions.service';
import { TransactionsService } from '../transactions/transactions.service';
import { DashboardService } from './dashboard.service';

function paginated<T>(data: T[]) {
  return { data, meta: { page: 1, limit: 20, totalItems: data.length, totalPages: 1 } };
}

describe('DashboardService', () => {
  let service: DashboardService;
  let accountsService: jest.Mocked<AccountsService>;
  let creditCardsService: jest.Mocked<CreditCardsService>;
  let transactionsService: jest.Mocked<TransactionsService>;
  let fixedTransactionsService: jest.Mocked<FixedTransactionsService>;

  const userId = 'user-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: AccountsService,
          useValue: {
            findAllByUser: jest.fn(),
          },
        },
        {
          provide: CreditCardsService,
          useValue: {
            findAllByUser: jest.fn(),
          },
        },
        {
          provide: TransactionsService,
          useValue: {
            findAllByUser: jest.fn(),
          },
        },
        {
          provide: FixedTransactionsService,
          useValue: {
            findAllActive: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    accountsService = module.get(AccountsService);
    creditCardsService = module.get(CreditCardsService);
    transactionsService = module.get(TransactionsService);
    fixedTransactionsService = module.get(FixedTransactionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOverview', () => {
    it('should return dashboard data with correct structure', async () => {
      accountsService.findAllByUser.mockResolvedValue(
        paginated([
          { id: 'acc-1', name: 'Main', balance: 5000 },
          { id: 'acc-2', name: 'Savings', balance: 3000 },
        ] as any),
      );

      creditCardsService.findAllByUser.mockResolvedValue(
        paginated([{ id: 'cc-1', name: 'Nubank', limitTotal: 5000, usedAmount: 1200, availableAmount: 3800 }] as any),
      );

      transactionsService.findAllByUser.mockResolvedValue(paginated([]));
      fixedTransactionsService.findAllActive.mockResolvedValue([
        { id: 'fx-1', description: 'Rent', value: 1200 },
      ] as any);

      const result = await service.getOverview(userId);

      expect(result.period).toHaveProperty('referenceDate');
      expect(result.period).toHaveProperty('startOfMonth');
      expect(result.period).toHaveProperty('endOfMonth');

      expect(result.totals.totalBalance).toBe(8000); // 5000 + 3000
      expect(result.totals.totalCreditLimit).toBe(5000);
      expect(result.totals.totalCreditUsed).toBe(1200);
      expect(result.totals.totalCreditAvailable).toBe(3800);
      expect(result.totals.currentMonth.income.value).toBe(0);
      expect(result.totals.currentMonth.expense.value).toBe(0);
      expect(result.totals.currentMonth.net.value).toBe(0);

      expect(result.accounts).toHaveLength(2);
      expect(result.creditCards).toHaveLength(1);
      expect(result.latestTransactions).toHaveLength(0);
      expect(result.fixedTransactions).toHaveLength(1);
      expect(result.annualBalance).toHaveLength(12);
    });

    it('should calculate trending and annual balance correctly', async () => {
      accountsService.findAllByUser.mockResolvedValue(paginated([]));
      creditCardsService.findAllByUser.mockResolvedValue(paginated([]));
      fixedTransactionsService.findAllActive.mockResolvedValue([]);

      // First call = current month, second = previous month, rest = annual months
      transactionsService.findAllByUser
        .mockResolvedValueOnce(
          paginated([
            { id: 't1', type: 'income', value: 6000 },
            { id: 't2', type: 'expense', value: 2000 },
          ]),
        )
        .mockResolvedValueOnce(
          paginated([
            { id: 't3', type: 'income', value: 5000 },
            { id: 't4', type: 'expense', value: 2500 },
          ]),
        )
        .mockResolvedValue(paginated([]));

      const result = await service.getOverview(userId);

      // Current month: income=6000, expense=2000, net=4000
      // Previous month: income=5000, expense=2500, net=2500
      expect(result.totals.currentMonth.income.value).toBe(6000);
      expect(result.totals.currentMonth.expense.value).toBe(2000);
      expect(result.totals.currentMonth.net.value).toBe(4000);

      // Trending: (4000 - 2500) / 2500 = 60%
      expect(result.totals.trending).toBe(60);
      expect(result.totals.currentMonth.net.trending).toBe(60);
      expect(result.totals.currentMonth.income.trending).toBe(20); // (6000-5000)/5000
      expect(result.totals.currentMonth.expense.trending).toBe(-20); // (2000-2500)/2500

      expect(result.annualBalance).toHaveLength(12);
    });

    it('should handle referenceDate parameter', async () => {
      accountsService.findAllByUser.mockResolvedValue(paginated([]));
      creditCardsService.findAllByUser.mockResolvedValue(paginated([]));
      transactionsService.findAllByUser.mockResolvedValue(paginated([]));
      fixedTransactionsService.findAllActive.mockResolvedValue([]);

      const result = await service.getOverview(userId, '2025-06-15');

      expect(result.period.referenceDate).toContain('2025-06-15');
    });

    it('should handle zero balance and no transactions', async () => {
      accountsService.findAllByUser.mockResolvedValue(paginated([]));
      creditCardsService.findAllByUser.mockResolvedValue(paginated([]));
      transactionsService.findAllByUser.mockResolvedValue(paginated([]));
      fixedTransactionsService.findAllActive.mockResolvedValue([]);

      const result = await service.getOverview(userId);

      expect(result.totals.totalBalance).toBe(0);
      expect(result.totals.totalCreditLimit).toBe(0);
      expect(result.totals.totalCreditUsed).toBe(0);
      expect(result.totals.totalCreditAvailable).toBe(0);
      expect(result.totals.currentMonth.income.value).toBe(0);
      expect(result.totals.currentMonth.expense.value).toBe(0);
      expect(result.totals.currentMonth.net.value).toBe(0);
      expect(result.latestTransactions).toHaveLength(0);
    });

    it('should calculate totals with both upper and lower case type values', async () => {
      accountsService.findAllByUser.mockResolvedValue(paginated([]));
      creditCardsService.findAllByUser.mockResolvedValue(paginated([]));
      fixedTransactionsService.findAllActive.mockResolvedValue([]);

      transactionsService.findAllByUser
        .mockResolvedValueOnce(
          paginated([
            { id: 't1', type: 'INCOME', value: 3000 },
            { id: 't2', type: 'EXPENSE', value: 1500 },
            { id: 't3', type: 'income', value: 1000 },
            { id: 't4', type: 'expense', value: 500 },
          ]),
        )
        .mockResolvedValue(paginated([]));

      const result = await service.getOverview(userId);

      expect(result.totals.currentMonth.income.value).toBe(4000); // 3000 + 1000
      expect(result.totals.currentMonth.expense.value).toBe(2000); // 1500 + 500
      expect(result.totals.currentMonth.net.value).toBe(2000);
    });
  });
});
