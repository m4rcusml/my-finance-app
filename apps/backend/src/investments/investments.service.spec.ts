import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { createMockPrismaService, type MockedPrismaService } from '../prisma/prisma.mock';
import { PrismaService } from '../prisma/prisma.service';
import { InvestmentsService } from './investments.service';

/**
 * The investment book is cost-basis only. These tests pin the civil-date
 * handling, the `investedAmount` invariant, and the cross-tenant hole that used
 * to let any user attach any asset id.
 */
describe('InvestmentsService', () => {
  let service: InvestmentsService;
  let prisma: MockedPrismaService;

  const userA = 'user-a';
  const userB = 'user-b';
  const investmentId = 'investment-1';
  const assetId = 'asset-1';

  const assetRow = {
    id: assetId,
    userId: userA,
    symbol: 'PETR4',
    type: 'stock',
    exchange: 'B3',
    name: 'Petrobras PN',
    createdAt: new Date('2026-01-10T12:00:00.000Z'),
    updatedAt: new Date('2026-01-10T12:00:00.000Z'),
  };

  // Money and quantities come back from Prisma as Decimals, i.e. as strings here.
  const investmentRow = {
    id: investmentId,
    userId: userA,
    marketAssetId: null,
    broker: 'XP Investimentos',
    type: 'stock',
    quantity: '100.00000000',
    buyPrice: '50.50',
    investedAmount: '5050.00',
    buyDate: new Date('2026-01-15T00:00:00.000Z'),
    createdAt: new Date('2026-01-16T12:00:00.000Z'),
    updatedAt: new Date('2026-01-16T12:00:00.000Z'),
    marketAsset: null,
  };

  const baseDto = {
    broker: 'XP Investimentos',
    type: 'stock' as const,
    quantity: 100,
    buyPrice: 50.5,
    buyDate: '2026-01-15',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvestmentsService, { provide: PrismaService, useValue: createMockPrismaService() }],
    }).compile();

    service = module.get(InvestmentsService);
    prisma = module.get(PrismaService) as unknown as MockedPrismaService;
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('defaults investedAmount to quantity × buyPrice and stores buyDate as a civil date', async () => {
      prisma.investment.create.mockResolvedValue(investmentRow);

      const result = await service.create(userA, baseDto);

      expect(prisma.investment.create).toHaveBeenCalledWith({
        data: {
          userId: userA,
          marketAssetId: null,
          broker: 'XP Investimentos',
          type: 'stock',
          quantity: 100,
          buyPrice: 50.5,
          investedAmount: 5050,
          buyDate: new Date('2026-01-15T00:00:00.000Z'),
        },
        include: { marketAsset: true },
      });
      expect(result.buyDate).toBe('2026-01-15');
      expect(result.investedAmount).toBe(5050);
      expect(result.quantity).toBe(100);
      expect(result.marketAsset).toBeNull();
      expect(result.createdAt).toBe('2026-01-16T12:00:00.000Z');
    });

    it('accepts a supplied investedAmount within one cent of the product', async () => {
      prisma.investment.create.mockResolvedValue(investmentRow);

      await service.create(userA, { ...baseDto, investedAmount: 5050.01 });

      expect(prisma.investment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ investedAmount: 5050.01 }) }),
      );
    });

    it('rejects an investedAmount that disagrees with quantity × buyPrice', async () => {
      await expect(service.create(userA, { ...baseDto, investedAmount: 9999 })).rejects.toThrow(BadRequestException);
      await expect(service.create(userA, { ...baseDto, investedAmount: 9999 })).rejects.toThrow(
        'investedAmount deve ser igual a quantity × buyPrice (esperado 5050.00).',
      );
      expect(prisma.investment.create).not.toHaveBeenCalled();
    });

    it('rejects a buyDate that is not a real calendar day', async () => {
      await expect(service.create(userA, { ...baseDto, buyDate: '2026-02-30' })).rejects.toThrow(BadRequestException);
      expect(prisma.investment.create).not.toHaveBeenCalled();
    });

    it('attaches an asset that belongs to the caller', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(assetRow);
      prisma.investment.create.mockResolvedValue({ ...investmentRow, marketAssetId: assetId, marketAsset: assetRow });

      const result = await service.create(userA, { ...baseDto, marketAssetId: assetId });

      expect(prisma.marketAsset.findUnique).toHaveBeenCalledWith({ where: { id: assetId } });
      expect(result.marketAsset).toMatchObject({ id: assetId, symbol: 'PETR4' });
    });

    // The regression that mattered: validateMarketAsset never received a userId.
    it('refuses to attach an asset owned by another user (404, not 403)', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(assetRow); // owned by userA

      await expect(service.create(userB, { ...baseDto, marketAssetId: assetId })).rejects.toThrow(NotFoundException);
      expect(prisma.investment.create).not.toHaveBeenCalled();
    });

    it('refuses to attach an ownerless legacy asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({ ...assetRow, userId: null });

      await expect(service.create(userA, { ...baseDto, marketAssetId: assetId })).rejects.toThrow(NotFoundException);
      expect(prisma.investment.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns the paginated envelope with the asset included', async () => {
      prisma.investment.findMany.mockResolvedValue([
        { ...investmentRow, marketAssetId: assetId, marketAsset: assetRow },
      ]);
      prisma.investment.count.mockResolvedValue(1);

      const result = await service.findAll(userA, { page: 1, limit: 20 });

      expect(prisma.investment.findMany).toHaveBeenCalledWith({
        where: { userId: userA },
        include: { marketAsset: true },
        skip: 0,
        take: 20,
        orderBy: [{ buyDate: 'desc' }, { id: 'desc' }],
      });
      expect(result.data[0].marketAsset).toMatchObject({ symbol: 'PETR4' });
      expect(result.meta.totalItems).toBe(1);
    });

    it('applies the type and marketAssetId filters', async () => {
      prisma.investment.findMany.mockResolvedValue([]);
      prisma.investment.count.mockResolvedValue(0);

      await service.findAll(userA, { type: 'crypto', marketAssetId: assetId });

      expect(prisma.investment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: userA, type: 'crypto', marketAssetId: assetId } }),
      );
    });

    it('always scopes the query to the caller', async () => {
      prisma.investment.findMany.mockResolvedValue([]);
      prisma.investment.count.mockResolvedValue(0);

      await service.findAll(userB);

      expect(prisma.investment.findMany.mock.calls[0][0].where.userId).toBe(userB);
    });
  });

  describe('findOne', () => {
    it('returns the investment when it belongs to the caller', async () => {
      prisma.investment.findUnique.mockResolvedValue(investmentRow);

      await expect(service.findOne(userA, investmentId)).resolves.toMatchObject({ id: investmentId });
    });

    it('throws 404 when it does not exist', async () => {
      prisma.investment.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userA, investmentId)).rejects.toThrow(NotFoundException);
    });

    it('throws 404 — never 403 — for another user’s investment', async () => {
      prisma.investment.findUnique.mockResolvedValue({ ...investmentRow, userId: userB });

      await expect(service.findOne(userA, investmentId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('leaves omitted keys untouched', async () => {
      prisma.investment.findUnique.mockResolvedValue(investmentRow);
      prisma.investment.update.mockResolvedValue({ ...investmentRow, broker: 'Rico' });

      await service.update(userA, investmentId, { broker: 'Rico' });

      expect(prisma.investment.update).toHaveBeenCalledWith({
        where: { id: investmentId },
        data: { broker: 'Rico', investedAmount: 5050 },
        include: { marketAsset: true },
      });
    });

    it('recomputes investedAmount when the quantity changes and none is supplied', async () => {
      prisma.investment.findUnique.mockResolvedValue(investmentRow);
      prisma.investment.update.mockResolvedValue(investmentRow);

      await service.update(userA, investmentId, { quantity: 200 });

      expect(prisma.investment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ quantity: 200, investedAmount: 10100 }) }),
      );
    });

    it('validates a supplied investedAmount against the FINAL quantity and price', async () => {
      prisma.investment.findUnique.mockResolvedValue(investmentRow);

      await expect(service.update(userA, investmentId, { quantity: 200, investedAmount: 5050 })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.investment.update).not.toHaveBeenCalled();
    });

    it('detaches the asset on an explicit null', async () => {
      prisma.investment.findUnique.mockResolvedValue({
        ...investmentRow,
        marketAssetId: assetId,
        marketAsset: assetRow,
      });
      prisma.investment.update.mockResolvedValue(investmentRow);

      const result = await service.update(userA, investmentId, { marketAssetId: null });

      expect(prisma.investment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ marketAssetId: null }) }),
      );
      expect(prisma.marketAsset.findUnique).not.toHaveBeenCalled();
      expect(result.marketAsset).toBeNull();
    });

    it('refuses to attach another user’s asset on PATCH', async () => {
      prisma.investment.findUnique.mockResolvedValue({ ...investmentRow, userId: userB });
      prisma.marketAsset.findUnique.mockResolvedValue(assetRow); // owned by userA

      await expect(service.update(userB, investmentId, { marketAssetId: assetId })).rejects.toThrow(NotFoundException);
      expect(prisma.investment.update).not.toHaveBeenCalled();
    });

    it('converts a patched buyDate through the civil-date helpers', async () => {
      prisma.investment.findUnique.mockResolvedValue(investmentRow);
      prisma.investment.update.mockResolvedValue({ ...investmentRow, buyDate: new Date('2026-03-01T00:00:00.000Z') });

      const result = await service.update(userA, investmentId, { buyDate: '2026-03-01' });

      expect(prisma.investment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ buyDate: new Date('2026-03-01T00:00:00.000Z') }),
        }),
      );
      expect(result.buyDate).toBe('2026-03-01');
    });
  });

  describe('remove', () => {
    it('deletes an investment owned by the caller', async () => {
      prisma.investment.findUnique.mockResolvedValue(investmentRow);
      prisma.investment.delete.mockResolvedValue(investmentRow);

      await service.remove(userA, investmentId);

      expect(prisma.investment.delete).toHaveBeenCalledWith({ where: { id: investmentId } });
    });

    it('throws 404 for another user’s investment', async () => {
      prisma.investment.findUnique.mockResolvedValue({ ...investmentRow, userId: userB });

      await expect(service.remove(userA, investmentId)).rejects.toThrow(NotFoundException);
      expect(prisma.investment.delete).not.toHaveBeenCalled();
    });
  });

  describe('getPortfolioSummary', () => {
    it('aggregates cost basis with groupBy and never reports value or return', async () => {
      prisma.investment.groupBy.mockResolvedValue([
        { type: 'stock', _sum: { investedAmount: '5050.00' }, _count: { _all: 2 } },
        { type: 'crypto', _sum: { investedAmount: '1200.50' }, _count: { _all: 1 } },
      ]);

      const result = await service.getPortfolioSummary(userA);

      expect(prisma.investment.groupBy).toHaveBeenCalledWith({
        by: ['type'],
        where: { userId: userA },
        _sum: { investedAmount: true },
        _count: { _all: true },
      });
      expect(result).toEqual({
        totalInvested: 6250.5,
        positions: 3,
        byType: [
          { type: 'crypto', totalInvested: 1200.5, positions: 1 },
          { type: 'stock', totalInvested: 5050, positions: 2 },
        ],
      });
      expect(result).not.toHaveProperty('currentValue');
      expect(result).not.toHaveProperty('profit');
      expect(result).not.toHaveProperty('returnPercentage');
    });

    it('returns zeros for an empty portfolio', async () => {
      prisma.investment.groupBy.mockResolvedValue([]);

      await expect(service.getPortfolioSummary(userA)).resolves.toEqual({
        totalInvested: 0,
        positions: 0,
        byType: [],
      });
    });
  });
});
