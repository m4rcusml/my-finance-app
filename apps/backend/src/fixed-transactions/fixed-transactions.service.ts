import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsService } from 'src/accounts/accounts.service';
import { CategoriesService } from 'src/categories/categories.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateFixedTransactionDto, UpdateFixedTransactionDto } from './fixed-transactions.dto';

@Injectable()
export class FixedTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService
  ) { }

  async createFixedTransaction(userId: string, dto: CreateFixedTransactionDto) {
    const { accountId, categoryId } = dto;

    await this.accountsService.findById(userId, accountId);
    await this.categoriesService.findById(userId, categoryId);

    await this.prisma.fixedTransaction.create({
      data: {
        ...dto,
        accountId,
        categoryId,
        userId
      }
    })
  }

  async findAllByUser(userId: string) {
    const response = await this.prisma.fixedTransaction.findMany({
      where: {
        userId
      }
    })

    return response;
  }

  async findById(userId: string, fixedId: string) {
    const response = await this.prisma.fixedTransaction.findUnique({
      where: {
        id: fixedId
      }
    })

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    return response;
  }

  async updateFixedTransaction(userId: string, fixedId: string, dto: UpdateFixedTransactionDto) {
    const response = await this.prisma.fixedTransaction.findUnique({
      where: { id: fixedId }
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
      where: { id: fixedId }
    })
  }

  async toggleActive(userId: string, fixedId: string, isActive: boolean) {
    const response = await this.prisma.fixedTransaction.findUnique({
      where: {
        id: fixedId
      }
    })

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    return await this.prisma.fixedTransaction.update({
      data: { isActive },
      where: { id: fixedId }
    })
  }
}
