import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMarketAssetDto, MarketAssetType, UpdateMarketAssetDto } from './market-assets.dto';
import { MarketAssetsService } from './market-assets.service';

describe('MarketAssetsService', () => {
  let service: MarketAssetsService;
  let prisma: jest.Mocked<PrismaService>;

  const userId = 'user-1';
  const assetId = 'asset-1';

  const baseAsset = {
    id: assetId,
    userId,
    symbol: 'PETR4',
    type: 'stock',
    exchange: 'B3',
    name: 'Petrobras PN',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketAssetsService,
        {
          provide: PrismaService,
          useValue: {
            marketAsset: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MarketAssetsService>(MarketAssetsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMarketAsset', () => {
    it('should create a market asset for the user', async () => {
      const dto: CreateMarketAssetDto = {
        symbol: 'PETR4',
        type: MarketAssetType.STOCK,
        exchange: 'B3',
        name: 'Petrobras PN',
      };
      prisma.marketAsset.findFirst.mockResolvedValue(null);
      prisma.marketAsset.create.mockResolvedValue(baseAsset as any);

      const result = await service.createMarketAsset(userId, dto);

      expect(prisma.marketAsset.findFirst).toHaveBeenCalledWith({
        where: { symbol: dto.symbol, exchange: dto.exchange },
      });
      expect(prisma.marketAsset.create).toHaveBeenCalledWith({
        data: { ...dto, userId },
      });
      expect(result.symbol).toBe('PETR4');
    });

    it('should throw ConflictException when symbol+exchange already exists', async () => {
      const dto: CreateMarketAssetDto = {
        symbol: 'PETR4',
        type: MarketAssetType.STOCK,
        exchange: 'B3',
      };
      prisma.marketAsset.findFirst.mockResolvedValue(baseAsset as any);

      await expect(service.createMarketAsset(userId, dto)).rejects.toThrow(ConflictException);
      expect(prisma.marketAsset.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return global assets plus user assets', async () => {
      prisma.marketAsset.findMany.mockResolvedValue([{ ...baseAsset, userId: null, symbol: 'BTC' }, baseAsset]);
      prisma.marketAsset.count.mockResolvedValue(2);

      const result = await service.findAll(userId, 1, 20);

      expect(prisma.marketAsset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ userId: null }, { userId }],
          },
        }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.meta.totalItems).toBe(2);
    });
  });

  describe('findById', () => {
    it('should return asset when owned', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(baseAsset);

      const result = await service.findById(userId, assetId);

      expect(result.id).toBe(assetId);
    });

    it('should return global asset when not owned', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({ ...baseAsset, userId: null });

      const result = await service.findById(userId, assetId);

      expect(result.userId).toBeNull();
    });

    it('should throw NotFoundException when asset does not exist', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(null);

      await expect(service.findById(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when asset belongs to another user', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({ ...baseAsset, userId: 'other-user' });

      await expect(service.findById(userId, assetId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateMarketAsset', () => {
    it('should update asset when owned', async () => {
      const dto: UpdateMarketAssetDto = { name: 'Updated' };
      prisma.marketAsset.findUnique.mockResolvedValue(baseAsset);
      prisma.marketAsset.update.mockResolvedValue({ ...baseAsset, ...dto });

      const result = await service.updateMarketAsset(userId, assetId, dto);

      expect(prisma.marketAsset.update).toHaveBeenCalledWith({
        data: dto,
        where: { id: assetId },
      });
      expect(result.name).toBe('Updated');
    });

    it('should throw ForbiddenException when updating global asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({ ...baseAsset, userId: null });

      await expect(service.updateMarketAsset(userId, assetId, {})).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when updating another user asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({ ...baseAsset, userId: 'other-user' });

      await expect(service.updateMarketAsset(userId, assetId, {})).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when asset does not exist', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(null);

      await expect(service.updateMarketAsset(userId, assetId, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteMarketAsset', () => {
    it('should delete asset when owned', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(baseAsset);
      prisma.marketAsset.delete.mockResolvedValue(baseAsset);

      await service.deleteMarketAsset(userId, assetId);

      expect(prisma.marketAsset.delete).toHaveBeenCalledWith({ where: { id: assetId } });
    });

    it('should throw ForbiddenException when deleting global asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({ ...baseAsset, userId: null });

      await expect(service.deleteMarketAsset(userId, assetId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when deleting another user asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({ ...baseAsset, userId: 'other-user' });

      await expect(service.deleteMarketAsset(userId, assetId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when asset does not exist', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(null);

      await expect(service.deleteMarketAsset(userId, assetId)).rejects.toThrow(NotFoundException);
    });
  });
});
