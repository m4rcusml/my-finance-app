import { Injectable } from '@nestjs/common';
import { endOfMonth, parseISO, startOfMonth } from 'date-fns';
import { AccountsService } from 'src/accounts/accounts.service';
import { FixedTransactionsService } from 'src/fixed-transactions/fixed-transactions.service';
import { TransactionsService } from 'src/transactions/transactions.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly transactionsService: TransactionsService,
    private readonly fixedTransactionsService: FixedTransactionsService
  ) { }

  async getOverview(userId: string, referenceDate?: string) {
    const date = referenceDate ? parseISO(referenceDate) : new Date();
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    // 1. Fetch data in parallel
    const [accounts, monthlyTransactions, allTransactions, fixedTransactions] = await Promise.all([
      this.accountsService.findAllByUser(userId),
      this.transactionsService.findAllByUser(userId, {
        fromDate: start.toISOString(),
        toDate: end.toISOString(),
      }),
      this.transactionsService.findAllByUser(userId),
      this.fixedTransactionsService.findAllActive(userId),
    ]);

    // 2. Calculate monthly totals
    const totalIncome = monthlyTransactions
      .filter(t => t.type === 'INCOME' || t.type === 'income') // Handle both cases just in case
      .reduce((acc, t) => acc + Number(t.value), 0);

    const totalExpense = monthlyTransactions
      .filter(t => t.type === 'EXPENSE' || t.type === 'expense')
      .reduce((acc, t) => acc + Number(t.value), 0);

    const net = totalIncome - totalExpense;

    // 3. Accounts are already returned with calculated balance from AccountsService
    const accountsWithBalance = accounts;

    // 4. Total balance
    const totalBalance = accountsWithBalance.reduce((acc, account) => acc + account.balance, 0);

    // 5. Latest transactions
    const latestTransactions = allTransactions.slice(0, 5); // Using slice 0, 5 for top 5 if sorted descending

    return {
      period: {
        referenceDate: date.toISOString(),
        startOfMonth: start.toISOString(),
        endOfMonth: end.toISOString(),
      },
      totals: {
        totalBalance,
        trending: 0,
        currentMonth: {
          income: {
            value: totalIncome,
            trending: 0,
          },
          expense: {
            value: totalExpense,
            trending: 0,
          },
          net: {
            value: net,
            trending: 0,
          },
        }
      },
      accounts: accountsWithBalance,
      latestTransactions,
      fixedTransactions,
      annualBalance: []
    };
  }
}
