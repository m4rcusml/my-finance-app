import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { buildPaginatedResponse } from '../shared/pagination.dto';
import { CreateAccountDto, UpdateAccountDto } from './accounts.dto';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAccount(userId: string, dto: CreateAccountDto) {
    return await this.prisma.account.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAllByUser(userId: string, page = 1, limit = 20) {
    const [accounts, total] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId },
        include: {
          transactions: {
            select: {
              type: true,
              value: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.account.count({ where: { userId } }),
    ]);

    const data = accounts.map((account) => {
      const balance = this.calculateAccountBalance(account);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { transactions: _, ...accountRest } = account;
      return {
        ...accountRest,
        balance,
      };
    });

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(userId: string, accountId: string) {
    const response = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: {
        transactions: {
          select: {
            type: true,
            value: true,
          },
        },
      },
    });

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    const balance = this.calculateAccountBalance(response);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { transactions: _, ...accountRest } = response;
    return {
      ...accountRest,
      balance,
    };
  }

  async updateAccount(userId: string, accountId: string, dto: UpdateAccountDto) {
    const response = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    const updated = await this.prisma.account.update({
      data: dto,
      where: { id: accountId },
      include: {
        transactions: {
          select: {
            type: true,
            value: true,
          },
        },
      },
    });

    const balance = this.calculateAccountBalance(updated);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { transactions: _, ...accountRest } = updated;
    return {
      ...accountRest,
      balance,
    };
  }

  async deleteAccount(userId: string, accountId: string) {
    const response = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    await this.prisma.account.delete({
      where: { id: accountId },
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: poggers
  private calculateAccountBalance(account: any) {
    const initialBalance = Number(account.initialBalance);

    // Calculate sums locally to avoid DB complexity
    const transactionsSum = account.transactions.reduce(
      (acc: number, t: { type: string; value: typeof account.initialBalance }) => {
        // Normalize type to lowercase for comparison
        const type = t.type.toLowerCase();
        const value = Number(t.value);

        if (type === 'income') {
          return acc + value;
        } else if (type === 'expense') {
          return acc - value;
        }
        return acc;
      },
      0,
    );

    return Number((initialBalance + transactionsSum).toFixed(2));
  }
}
