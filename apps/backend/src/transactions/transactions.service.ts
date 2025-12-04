import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsService } from 'src/accounts/accounts.service';
import { CategoriesService } from 'src/categories/categories.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTransactionDto, ListTransactionsQueryDto, UpdateTransactionDto } from './transactions.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
  ) { }

  async create(userId: string, dto: CreateTransactionDto) {
    const { accountId, categoryId } = dto;

    await this.accountsService.findById(userId, accountId)

    if (categoryId) {
      await this.categoriesService.findById(userId, categoryId)
    }

    return await this.prisma.transaction.create({
      data: {
        ...dto,
        userId
      }
    })
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

    return await this.prisma.transaction.findMany({
      where,
      orderBy: {
        date: 'desc'
      }
    });
  }

  async findById(userId: string, id: string) {
    const response = await this.prisma.transaction.findUnique({
      where: { id }
    })

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

    return await this.prisma.transaction.findMany({
      where,
      orderBy: {
        date: 'desc'
      }
    });
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const response = await this.prisma.transaction.findUnique({
      where: { id }
    })

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    if (dto.categoryId) {
      await this.categoriesService.findById(userId, dto.categoryId)
    }

    if (dto.accountId) {
      await this.accountsService.findById(userId, dto.accountId)
    }

    return await this.prisma.transaction.update({
      data: dto,
      where: { id }
    })
  }

  async delete(userId: string, id: string) {
    const response = await this.prisma.transaction.findUnique({
      where: { id }
    })

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    await this.prisma.transaction.delete({
      where: { id }
    })
  }
}
