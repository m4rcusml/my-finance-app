import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsService } from 'src/accounts/accounts.service';
import { CategoriesService } from 'src/categories/categories.service';
import { CreditCardsService } from 'src/credit-cards/credit-cards.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { buildPaginatedResponse } from '../shared/pagination.dto';
import { CreateTransactionDto, ListTransactionsQueryDto, UpdateTransactionDto } from './transactions.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
    private readonly creditCardsService: CreditCardsService,
  ) {}

  async create(userId: string, dto: CreateTransactionDto) {
    const { accountId, creditCardId, categoryId } = dto;

    if (!accountId && !creditCardId) {
      throw new BadRequestException('Either accountId or creditCardId must be provided');
    }

    if (accountId && creditCardId) {
      throw new BadRequestException('Cannot provide both accountId and creditCardId');
    }

    if (accountId) {
      await this.accountsService.findById(userId, accountId);
    }

    if (creditCardId) {
      await this.creditCardsService.findById(userId, creditCardId);
    }

    if (categoryId) {
      await this.categoriesService.findById(userId, categoryId);
    }

    return await this.prisma.transaction.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAllByUser(userId: string, filters?: ListTransactionsQueryDto) {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation> Must be any to be rewritable
    const where: any = {
      userId,
    };

    if (filters) {
      if (filters.type) {
        where.type = filters.type;
      }

      if (filters.accountId) {
        where.accountId = filters.accountId;
      }

      if (filters.creditCardId) {
        where.creditCardId = filters.creditCardId;
      }

      if (filters.categoryId) {
        where.categoryId = filters.categoryId;
      }

      if (filters.fromDate || filters.toDate) {
        where.date = {};
        if (filters.fromDate) {
          where.date.gte = new Date(filters.fromDate);
        }
        if (filters.toDate) {
          where.date.lte = new Date(filters.toDate);
        }
      }
    }

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: {
          date: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return buildPaginatedResponse(transactions, total, page, limit);
  }

  async findById(userId: string, id: string) {
    const response = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    return response;
  }

  async findUncategorized(userId: string, filters?: ListTransactionsQueryDto) {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation> Must be any to be rewritable
    const where: any = {
      userId,
      categoryId: null,
    };

    if (filters) {
      if (filters.type) {
        where.type = filters.type;
      }

      if (filters.accountId) {
        where.accountId = filters.accountId;
      }

      if (filters.creditCardId) {
        where.creditCardId = filters.creditCardId;
      }

      if (filters.fromDate || filters.toDate) {
        where.date = {};
        if (filters.fromDate) {
          where.date.gte = new Date(filters.fromDate);
        }
        if (filters.toDate) {
          where.date.lte = new Date(filters.toDate);
        }
      }
    }

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: {
          date: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return buildPaginatedResponse(transactions, total, page, limit);
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const response = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    const { accountId, creditCardId } = dto;

    if (accountId && creditCardId) {
      throw new BadRequestException('Cannot provide both accountId and creditCardId');
    }

    if (dto.categoryId) {
      await this.categoriesService.findById(userId, dto.categoryId);
    }

    if (dto.accountId) {
      await this.accountsService.findById(userId, dto.accountId);
    }

    if (dto.creditCardId) {
      await this.creditCardsService.findById(userId, dto.creditCardId);
    }

    return await this.prisma.transaction.update({
      data: dto,
      where: { id },
    });
  }

  async delete(userId: string, id: string) {
    const response = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    await this.prisma.transaction.delete({
      where: { id },
    });
  }

  async getSummary(userId: string, fromDate: string, toDate: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: new Date(fromDate),
          lte: new Date(toDate),
        },
      },
    });

    let income = 0;
    let expense = 0;

    for (const t of transactions) {
      const value = this.toNumber(t.value);
      if (t.type === 'income') {
        income += value;
      } else {
        expense += value;
      }
    }

    return {
      income: Number(income.toFixed(2)),
      expense: Number(expense.toFixed(2)),
      net: Number((income - expense).toFixed(2)),
      count: transactions.length,
    };
  }

  async getProjection(userId: string) {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'expense',
        date: {
          gte: threeMonthsAgo,
        },
      },
    });

    // Group by month (YYYY-MM)
    const monthlyTotals = new Map<string, number>();

    for (const t of transactions) {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const current = monthlyTotals.get(key) ?? 0;
      monthlyTotals.set(key, current + this.toNumber(t.value));
    }

    const months = monthlyTotals.size;
    const total = Array.from(monthlyTotals.values()).reduce((sum, val) => sum + val, 0);
    const projectedExpense = months > 0 ? Number((total / months).toFixed(2)) : 0;

    return {
      projectedExpense,
      basedOnMonths: months,
    };
  }

  private toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    if (typeof value.toNumber === 'function') return value.toNumber();
    if (typeof value.valueOf === 'function') return value.valueOf();
    return Number(value);
  }
}
