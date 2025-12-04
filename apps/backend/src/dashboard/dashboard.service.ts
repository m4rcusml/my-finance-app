import { Injectable } from '@nestjs/common';
import { endOfMonth, parseISO, startOfMonth } from 'date-fns';
import { AccountsService } from 'src/accounts/accounts.service';
import { TransactionsService } from 'src/transactions/transactions.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly transactionsService: TransactionsService,
  ) { }

  async getOverview(userId: string, referenceDate?: string) {
    const date = referenceDate ? parseISO(referenceDate) : new Date();
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    // saldo por mes
    const accounts = await this.accountsService.findAllByUser(userId);
    const monthlyTransactions = await this.transactionsService.findAllByUser(
      userId,
      {
        fromDate: start.toISOString(),
        toDate: end.toISOString(),
      }
    );

    const totalIncome = monthlyTransactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => acc + t.value.toNumber(), 0);

    const totalExpense = monthlyTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => acc + t.value.toNumber(), 0);

    const net = totalIncome - totalExpense;

    // 2 - saldo por conta
    const allTransactions = await this.transactionsService.findAllByUser(userId);

    const accountsWithBalance = accounts.map(account => {
      const accountTransactions = allTransactions.filter(t => t.accountId === account.id);

      const income = accountTransactions
        .filter(t => t.type === 'income')
        .reduce((acc, t) => acc + t.value.toNumber(), 0);

      const expense = accountTransactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + t.value.toNumber(), 0);

      const balance = account.initialBalance.toNumber() + income - expense;

      return {
        ...account,
        balance,
      };
    });

    // 3 - saldo total
    const totalBalance = accountsWithBalance.reduce((acc, account) => acc + account.balance, 0);

    return {
      period: {
        referenceDate: date.toISOString(),
        startOfMonth: start.toISOString(),
        endOfMonth: end.toISOString(),
      },
      totals: {
        totalBalance,
        currentMonth: {
          income: totalIncome,
          expense: totalExpense,
          net,
        }
      },
      accounts: accountsWithBalance
    };
  }
}
