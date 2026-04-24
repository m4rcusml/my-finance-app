import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCreditCardDto, UpdateCreditCardDto } from './credit-cards.dto';

@Injectable()
export class CreditCardsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCreditCard(userId: string, dto: CreateCreditCardDto) {
    return await this.prisma.creditCard.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAllByUser(userId: string) {
    const creditCards = await this.prisma.creditCard.findMany({
      where: { userId },
      include: {
        transactions: {
          where: {
            type: 'expense',
          },
          select: {
            value: true,
          },
        },
      },
    });

    return creditCards.map((card) => {
      const usedAmount = this.calculateUsedAmount(card.transactions);
      const limitTotal = Number(card.limitTotal);
      return {
        ...card,
        limitTotal,
        usedAmount,
        availableAmount: Number((limitTotal - usedAmount).toFixed(2)),
      };
    });
  }

  async findById(userId: string, creditCardId: string) {
    const response = await this.prisma.creditCard.findUnique({
      where: { id: creditCardId },
      include: {
        transactions: {
          where: {
            type: 'expense',
          },
          select: {
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

    const usedAmount = this.calculateUsedAmount(response.transactions);
    const limitTotal = Number(response.limitTotal);

    return {
      ...response,
      limitTotal,
      usedAmount,
      availableAmount: Number((limitTotal - usedAmount).toFixed(2)),
    };
  }

  async updateCreditCard(userId: string, creditCardId: string, dto: UpdateCreditCardDto) {
    const response = await this.prisma.creditCard.findUnique({
      where: { id: creditCardId },
    });

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    return await this.prisma.creditCard.update({
      data: dto,
      where: { id: creditCardId },
    });
  }

  async deleteCreditCard(userId: string, creditCardId: string) {
    const response = await this.prisma.creditCard.findUnique({
      where: { id: creditCardId },
    });

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    await this.prisma.creditCard.delete({
      where: { id: creditCardId },
    });
  }

  private calculateUsedAmount(transactions?: { value: number | { toNumber: () => number } }[] | null): number {
    return (transactions || []).reduce((acc, t) => {
      return acc + Number(t.value);
    }, 0);
  }
}
