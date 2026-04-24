import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { buildPaginatedResponse } from '../shared/pagination.dto';
import { CreateInvestmentDto, UpdateInvestmentDto } from './investments.dto';

@Injectable()
export class InvestmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvestment(userId: string, dto: CreateInvestmentDto) {
    this.validateInvestedAmount(dto.quantity, dto.buyPrice, dto.investedAmount);

    if (dto.marketAssetId) {
      await this.validateMarketAsset(dto.marketAssetId);
    }

    return await this.prisma.investment.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAllByUser(userId: string, page = 1, limit = 20) {
    const [investments, total] = await Promise.all([
      this.prisma.investment.findMany({
        where: { userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.investment.count({ where: { userId } }),
    ]);

    return buildPaginatedResponse(investments, total, page, limit);
  }

  async findById(userId: string, investmentId: string) {
    const investment = await this.prisma.investment.findUnique({
      where: { id: investmentId },
    });

    if (!investment) {
      throw new NotFoundException();
    }

    if (investment.userId !== userId) {
      throw new ForbiddenException();
    }

    return investment;
  }

  async updateInvestment(userId: string, investmentId: string, dto: UpdateInvestmentDto) {
    const investment = await this.prisma.investment.findUnique({
      where: { id: investmentId },
    });

    if (!investment) {
      throw new NotFoundException();
    }

    if (investment.userId !== userId) {
      throw new ForbiddenException();
    }

    const quantity = dto.quantity ?? investment.quantity;
    const buyPrice = dto.buyPrice ?? investment.buyPrice;
    const investedAmount = dto.investedAmount ?? investment.investedAmount;

    this.validateInvestedAmount(Number(quantity), Number(buyPrice), Number(investedAmount));

    if (dto.marketAssetId) {
      await this.validateMarketAsset(dto.marketAssetId);
    }

    return await this.prisma.investment.update({
      data: dto,
      where: { id: investmentId },
    });
  }

  async deleteInvestment(userId: string, investmentId: string) {
    const investment = await this.prisma.investment.findUnique({
      where: { id: investmentId },
    });

    if (!investment) {
      throw new NotFoundException();
    }

    if (investment.userId !== userId) {
      throw new ForbiddenException();
    }

    await this.prisma.investment.delete({
      where: { id: investmentId },
    });
  }

  private validateInvestedAmount(quantity: number, buyPrice: number, investedAmount: number): void {
    const expected = Number((quantity * buyPrice).toFixed(2));
    const actual = Number(investedAmount.toFixed(2));

    if (Math.abs(expected - actual) > 0.01) {
      throw new BadRequestException('investedAmount must match quantity * buyPrice');
    }
  }

  private async validateMarketAsset(marketAssetId: string): Promise<void> {
    const asset = await this.prisma.marketAsset.findUnique({
      where: { id: marketAssetId },
    });

    if (!asset) {
      throw new BadRequestException('marketAsset not found');
    }
  }
}
