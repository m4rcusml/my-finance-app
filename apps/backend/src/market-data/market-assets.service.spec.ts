import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { createMockPrismaService, type MockedPrismaService } from '../prisma/prisma.mock';
import { PrismaService } from '../prisma/prisma.service';
import { MarketAssetsService } from './market-assets.service';

/**
 * The catalogue is a plain per-user list of labels: no quotes, no prices, no
 * history. These tests pin the two things that used to be wrong — the shared
 * global catalogue and the update path that skipped the uniqueness check.
 */
describe('MarketAssetsService', () => {
  let service: MarketAssetsService;
  let prisma: MockedPrismaService;

  const userId = 'user-a';
  const otherUserId = 'user-b';
  const assetId = 'asset-1';

  const assetRow = {
    id: assetId,
    userId,
    symbol: 'PETR4',
    type: 'stock',
    exchange: 'B3',
    name: 'Petrobras PN',
    createdAt: new Date('2026-01-10T12:00:00.000Z'),
    updatedAt: new Date('2026-01-11T12:00:00.000Z'),
  };

  /** Prisma reports a violated unique index with this code. */
  const uniqueViolation = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MarketAssetsService, { provide: PrismaService, useValue: createMockPrismaService() }],
    }).compile();

    service = module.get(MarketAssetsService);
    prisma = module.get(PrismaService) as unknown as MockedPrismaService;
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('stores the asset under the caller and returns the contract shape', async () => {
      prisma.marketAsset.create.mockResolvedValue(assetRow);

      const result = await service.create(userId, {
        symbol: 'PETR4',
        type: 'stock',
        exchange: 'B3',
        name: 'Petrobras PN',
      });

      expect(prisma.marketAsset.create).toHaveBeenCalledWith({
        data: { userId, symbol: 'PETR4', type: 'stock', exchange: 'B3', name: 'Petrobras PN' },
      });
      expect(result).toEqual({
        id: assetId,
        symbol: 'PETR4',
        type: 'stock',
        exchange: 'B3',
        name: 'Petrobras PN',
        createdAt: '2026-01-10T12:00:00.000Z',
        updatedAt: '2026-01-11T12:00:00.000Z',
      });
      expect(result).not.toHaveProperty('userId');
    });

    it('defaults a missing name to null', async () => {
      prisma.marketAsset.create.mockResolvedValue({ ...assetRow, name: null });

      const result = await service.create(userId, { symbol: 'PETR4', type: 'stock', exchange: 'B3' });

      expect(prisma.marketAsset.create).toHaveBeenCalledWith({
        data: { userId, symbol: 'PETR4', type: 'stock', exchange: 'B3', name: null },
      });
      expect(result.name).toBeNull();
    });

    it('turns the unique-index violation into a 409 in pt-BR', async () => {
      prisma.marketAsset.create.mockRejectedValue(uniqueViolation);

      await expect(service.create(userId, { symbol: 'PETR4', type: 'stock', exchange: 'B3' })).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(userId, { symbol: 'PETR4', type: 'stock', exchange: 'B3' })).rejects.toThrow(
        'Já existe um ativo com esse símbolo nesta bolsa.',
      );
    });

    it('does not swallow unrelated database errors', async () => {
      prisma.marketAsset.create.mockRejectedValue(new Error('connection lost'));

      await expect(service.create(userId, { symbol: 'PETR4', type: 'stock', exchange: 'B3' })).rejects.toThrow(
        'connection lost',
      );
    });
  });

  describe('findAll', () => {
    it('filters strictly by the caller and returns the paginated envelope', async () => {
      prisma.marketAsset.findMany.mockResolvedValue([assetRow]);
      prisma.marketAsset.count.mockResolvedValue(1);

      const result = await service.findAll(userId, { page: 2, limit: 5 });

      expect(prisma.marketAsset.findMany).toHaveBeenCalledWith({
        where: { userId },
        skip: 5,
        take: 5,
        orderBy: [{ symbol: 'asc' }, { exchange: 'asc' }],
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 2,
        limit: 5,
        totalItems: 1,
        totalPages: 1,
        hasPreviousPage: true,
        hasNextPage: false,
      });
    });

    it('never widens the filter to ownerless legacy rows', async () => {
      prisma.marketAsset.findMany.mockResolvedValue([]);
      prisma.marketAsset.count.mockResolvedValue(0);

      await service.findAll(userId);

      const where = prisma.marketAsset.findMany.mock.calls[0][0].where;
      expect(where).toEqual({ userId });
      expect(JSON.stringify(where)).not.toContain('OR');
    });

    it('clamps an absent page/limit to the defaults', async () => {
      prisma.marketAsset.findMany.mockResolvedValue([]);
      prisma.marketAsset.count.mockResolvedValue(0);

      const result = await service.findAll(userId);

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(prisma.marketAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20, skip: 0 }));
    });
  });

  describe('findOne', () => {
    it('returns the asset when it belongs to the caller', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(assetRow);

      await expect(service.findOne(userId, assetId)).resolves.toMatchObject({ id: assetId, symbol: 'PETR4' });
    });

    it('throws 404 when the asset does not exist', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId, assetId)).rejects.toThrow(NotFoundException);
    });

    it('throws 404 — never 403 — for another user’s asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({ ...assetRow, userId: otherUserId });

      await expect(service.findOne(userId, assetId)).rejects.toThrow(NotFoundException);
    });

    it('hides ownerless legacy rows behind the same 404', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({ ...assetRow, userId: null });

      await expect(service.findOne(userId, assetId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('patches only the keys that were sent', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(assetRow);
      prisma.marketAsset.update.mockResolvedValue({ ...assetRow, symbol: 'VALE3' });

      await service.update(userId, assetId, { symbol: 'VALE3' });

      expect(prisma.marketAsset.update).toHaveBeenCalledWith({
        where: { id: assetId },
        data: { symbol: 'VALE3' },
      });
    });

    it('clears the name on an explicit null', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(assetRow);
      prisma.marketAsset.update.mockResolvedValue({ ...assetRow, name: null });

      const result = await service.update(userId, assetId, { name: null });

      expect(prisma.marketAsset.update).toHaveBeenCalledWith({ where: { id: assetId }, data: { name: null } });
      expect(result.name).toBeNull();
    });

    it('enforces uniqueness on update too, as a 409', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(assetRow);
      prisma.marketAsset.update.mockRejectedValue(uniqueViolation);

      await expect(service.update(userId, assetId, { symbol: 'VALE3' })).rejects.toThrow(ConflictException);
    });

    it('refuses to touch another user’s asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({ ...assetRow, userId: otherUserId });

      await expect(service.update(userId, assetId, { symbol: 'VALE3' })).rejects.toThrow(NotFoundException);
      expect(prisma.marketAsset.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an asset that no investment references', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(assetRow);
      prisma.investment.count.mockResolvedValue(0);
      prisma.marketAsset.delete.mockResolvedValue(assetRow);

      await service.remove(userId, assetId);

      expect(prisma.investment.count).toHaveBeenCalledWith({ where: { marketAssetId: assetId } });
      expect(prisma.marketAsset.delete).toHaveBeenCalledWith({ where: { id: assetId } });
    });

    it('refuses with 409 while investments still point at it', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(assetRow);
      prisma.investment.count.mockResolvedValue(3);

      await expect(service.remove(userId, assetId)).rejects.toThrow(ConflictException);
      await expect(service.remove(userId, assetId)).rejects.toThrow(
        'Ativo em uso por investimentos e não pode ser excluído.',
      );
      expect(prisma.marketAsset.delete).not.toHaveBeenCalled();
    });

    it('throws 404 for another user’s asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({ ...assetRow, userId: otherUserId });

      await expect(service.remove(userId, assetId)).rejects.toThrow(NotFoundException);
      expect(prisma.marketAsset.delete).not.toHaveBeenCalled();
    });
  });
});
