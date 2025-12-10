import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FixedTransactionsService } from 'src/fixed-transactions/fixed-transactions.service';
import { FixedTransactionsOccurrencesService } from 'src/fixed-transactions/fixed-transactions-occurrences.service';

@Injectable()
export class FixedTransactionsJob {
  constructor(
    private readonly fixedTransactionsService: FixedTransactionsService,
    private readonly fixedTransactionsOccurrencesService: FixedTransactionsOccurrencesService
  ) { }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleFixedTransactions() {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const fixedTransactions = await this.fixedTransactionsService.findAllActive()

    fixedTransactions.forEach(async t => { // não usar forEach
      const fromDay = t.referenceDay - t.marginDays;
      const toDay = t.referenceDay + t.marginDays;

      if (day >= fromDay && day <= toDay) {
        const occurrences = await this.fixedTransactionsOccurrencesService.listAllByUser(t.userId, { month, year })
        const filteredOccurrences = occurrences.filter(o => o.fixedTransactionId === t.id)
        // criar um método existsForPeriod(fixedTransactionId, year, month)

        if (filteredOccurrences.length === 0) {
          await this.fixedTransactionsOccurrencesService.createOccurrence(t.userId, t.id, year, month);
        }
      }
    })
  }
}
