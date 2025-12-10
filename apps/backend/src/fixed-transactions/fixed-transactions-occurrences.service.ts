import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

interface ListOccurrencesFilter {
  year: number;
  month: number;
  status: 'PENDING' | 'CONFIRMED' | 'SKIPPED';
}

@Injectable()
export class FixedTransactionsService {
  constructor(private readonly prisma: PrismaService) { }

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
      data: { realDate, status: 'CONFIRMED' },
      where: { id: occurrenceId }
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
