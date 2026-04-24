import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { buildPaginatedResponse } from '../shared/pagination.dto';
import { CreateMarketAssetDto, UpdateMarketAssetDto } from './market-assets.dto';

@Injectable()
export class MarketAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async createMarketAsset(userId: string, dto: CreateMarketAssetDto) {
    const existing = await this.prisma.marketAsset.findFirst({
      where: { symbol: dto.symbol, exchange: dto.exchange },
    });

    if (existing) {
      throw new ConflictException('Market asset with this symbol and exchange already exists');
    }

    return await this.prisma.marketAsset.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAll(userId: string, page = 1, limit = 20) {
    const where = {
      OR: [{ userId: null }, { userId }],
    };

    const [assets, total] = await Promise.all([
      this.prisma.marketAsset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.marketAsset.count({ where }),
    ]);

    return buildPaginatedResponse(assets, total, page, limit);
  }

  async findById(userId: string, assetId: string) {
    const asset = await this.prisma.marketAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException();
    }

    if (asset.userId !== null && asset.userId !== userId) {
      throw new ForbiddenException();
    }

    return asset;
  }

  async updateMarketAsset(userId: string, assetId: string, dto: UpdateMarketAssetDto) {
    const asset = await this.prisma.marketAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException();
    }

    if (asset.userId !== userId) {
      throw new ForbiddenException();
    }

    return await this.prisma.marketAsset.update({
      data: dto,
      where: { id: assetId },
    });
  }

  async deleteMarketAsset(userId: string, assetId: string) {
    const asset = await this.prisma.marketAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException();
    }

    if (asset.userId !== userId) {
      throw new ForbiddenException();
    }

    await this.prisma.marketAsset.delete({
      where: { id: assetId },
    });
  }
}
