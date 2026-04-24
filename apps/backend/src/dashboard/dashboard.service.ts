import { Injectable } from '@nestjs/common';
import { endOfMonth, parseISO, startOfMonth, subMonths } from 'date-fns';
import { AccountsService } from 'src/accounts/accounts.service';
import { CreditCardsService } from 'src/credit-cards/credit-cards.service';
import { FixedTransactionsService } from 'src/fixed-transactions/fixed-transactions.service';
import { TransactionsService } from 'src/transactions/transactions.service';

interface MonthlyTotals {
  income: number;
  expense: number;
  net: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly creditCardsService: CreditCardsService,
    private readonly transactionsService: TransactionsService,
    private readonly fixedTransactionsService: FixedTransactionsService,
  ) {}

  async getOverview(userId: string, referenceDate?: string) {
    const date = referenceDate ? parseISO(referenceDate) : new Date();
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const prevMonthStart = startOfMonth(subMonths(date, 1));
    const prevMonthEnd = endOfMonth(subMonths(date, 1));

    // 1. Fetch data in parallel
    const [
      accounts,
      creditCards,
      monthlyTransactions,
      prevMonthTransactions,
      allTransactions,
      fixedTransactions,
    ] = await Promise.all([
      this.accountsService.findAllByUser(userId),
      this.creditCardsService.findAllByUser(userId),
      this.transactionsService.findAllByUser(userId, {
        fromDate: start.toISOString(),
        toDate: end.toISOString(),
      }),
      this.transactionsService.findAllByUser(userId, {
        fromDate: prevMonthStart.toISOString(),
        toDate: prevMonthEnd.toISOString(),
      }),
      this.transactionsService.findAllByUser(userId),
      this.fixedTransactionsService.findAllActive(userId),
    ]);

    // 2. Calculate monthly totals
    const currentMonth = this.calculateMonthlyTotals(monthlyTransactions);
    const previousMonth = this.calculateMonthlyTotals(prevMonthTransactions);

    // 3. Accounts are already returned with calculated balance from AccountsService
    const accountsWithBalance = accounts;

    // 4. Total balance
    const totalBalance = accountsWithBalance.reduce((acc, account) => acc + account.balance, 0);

    // 5. Credit card totals
    const totalCreditLimit = creditCards.reduce((acc, card) => acc + card.limitTotal, 0);
    const totalCreditUsed = creditCards.reduce((acc, card) => acc + card.usedAmount, 0);
    const totalCreditAvailable = Number((totalCreditLimit - totalCreditUsed).toFixed(2));

    // 6. Latest transactions
    const latestTransactions = allTransactions.slice(0, 5);

    // 7. Annual balance (last 12 months)
    const annualBalance = await this.calculateAnnualBalance(userId, date);

    return {
      period: {
        referenceDate: date.toISOString(),
        startOfMonth: start.toISOString(),
        endOfMonth: end.toISOString(),
      },
      totals: {
        totalBalance,
        totalCreditLimit,
        totalCreditUsed,
        totalCreditAvailable,
        trending: this.calculateTrending(currentMonth.net, previousMonth.net),
        currentMonth: {
          income: {
            value: currentMonth.income,
            trending: this.calculateTrending(currentMonth.income, previousMonth.income),
          },
          expense: {
            value: currentMonth.expense,
            trending: this.calculateTrending(currentMonth.expense, previousMonth.expense),
          },
          net: {
            value: currentMonth.net,
            trending: this.calculateTrending(currentMonth.net, previousMonth.net),
          },
        },
      },
      accounts: accountsWithBalance,
      creditCards,
      latestTransactions,
      fixedTransactions,
      annualBalance,
    };
  }

  private calculateMonthlyTotals(transactions: { type: string; value: number | { toNumber: () => number } }[]): MonthlyTotals {
    const income = transactions
      .filter((t) => t.type === 'INCOME' || t.type === 'income')
      .reduce((acc, t) => acc + Number(t.value), 0);

    const expense = transactions
      .filter((t) => t.type === 'EXPENSE' || t.type === 'expense')
      .reduce((acc, t) => acc + Number(t.value), 0);

    return { income, expense, net: income - expense };
  }

  private calculateTrending(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(2));
  }

  private async calculateAnnualBalance(userId: string, referenceDate: Date) {
    const months: { month: string; net: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(referenceDate, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const transactions = await this.transactionsService.findAllByUser(userId, {
        fromDate: monthStart.toISOString(),
        toDate: monthEnd.toISOString(),
      });

      const totals = this.calculateMonthlyTotals(transactions);
      months.push({
        month: monthDate.toISOString().slice(0, 7), // YYYY-MM format
        net: totals.net,
      });
    }

    return months;
  }
}
