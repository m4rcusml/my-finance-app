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

    // entradas e saídas do mes
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

    // 4 - últimas transações
    const latestTransactions = allTransactions.slice(-5);

    // 5- transações fixas abertas do mês
    const fixedTransactions = await this.fixedTransactionsService.findAllActive(userId);

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
