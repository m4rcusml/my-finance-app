import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransactionsService } from 'src/transactions/transactions.service';
import { FixedTransactionsService } from './fixed-transactions.service';

interface ListOccurrencesFilter {
  year: number;
  month: number;
  status: 'PENDING' | 'CONFIRMED' | 'SKIPPED';
}

@Injectable()
export class FixedTransactionsOccurrencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fixedTransactionsService: FixedTransactionsService,
    private readonly transactionsService: TransactionsService
  ) { }

  async listAllByUser(userId: string, { year, month, status }: ListOccurrencesFilter) {
    return await this.prisma.fixedTransactionOccurrence.findMany({
      where: {
        userId,
        status,
        periodYear: year,
        periodMonth: month
      }
    })
  }

  async confirmOccurrence(userId: string, occurrenceId: string, realDate?: string) {
    const response = await this.prisma.fixedTransactionOccurrence.findUnique({
      where: { id: occurrenceId }
    })

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    if (response.status === 'CONFIRMED') {
      return response;
    }

    const currentDate = new Date().toISOString();
    const { type, value, accountId, categoryId, description } = await this.fixedTransactionsService.findById(userId, occurrenceId);
    const { id: transactionId } = await this.transactionsService.create(userId, {
      // @ts-expect-error
      type, accountId, categoryId,
      value: value.toNumber(),
      description: description ?? undefined,
      date: realDate ?? currentDate
    })

    return await this.prisma.fixedTransactionOccurrence.update({
      data: { realDate: realDate ?? currentDate, status: 'CONFIRMED' },
      where: { id: occurrenceId, transactionId }
    })
  }

  async skipOccurrence(userId: string, occurrenceId: string) {
    const response = await this.prisma.fixedTransaction.findUnique({
      where: { id: occurrenceId }
    })

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    return await this.prisma.fixedTransactionOccurrence.update({
      data: { status: 'SKIPPED' },
      where: { id: occurrenceId }
    })
  }
}
