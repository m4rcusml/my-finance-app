import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { createMockPrismaService, type MockedPrismaService } from '../prisma/prisma.mock';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: MockedPrismaService;

  const userId = 'user-1';
  const categoryId = 'category-1';
  const createdAt = new Date('2026-01-10T12:00:00.000Z');
  const updatedAt = new Date('2026-01-11T12:00:00.000Z');

  const baseCategory = {
    id: categoryId,
    userId,
    name: 'Mercado',
    type: 'expense' as const,
    isActive: true,
    archivedAt: null,
    createdAt,
    updatedAt,
  };

  function withoutDependents() {
    prisma.transaction.count.mockResolvedValue(0);
    prisma.fixedTransaction.count.mockResolvedValue(0);
    prisma.fixedTransactionOccurrence.count.mockResolvedValue(0);
    prisma.goal.count.mockResolvedValue(0);
  }

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(CategoriesService);
    prisma.category.findFirst.mockResolvedValue(null);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates the category and returns the contract shape', async () => {
      prisma.category.create.mockResolvedValue(baseCategory);

      const result = await service.create(userId, { name: 'Mercado', type: 'expense' });

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { userId, name: 'Mercado', type: 'expense' },
      });
      expect(result).toEqual({
        id: categoryId,
        name: 'Mercado',
        type: 'expense',
        isActive: true,
        archivedAt: null,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
    });

    it('rejects a duplicate (userId, name, type) with a pt-BR 409', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'other' });

      await expect(service.create(userId, { name: 'Mercado', type: 'expense' })).rejects.toThrow(ConflictException);
      await expect(service.create(userId, { name: 'Mercado', type: 'expense' })).rejects.toThrow(
        'Você já tem uma categoria "Mercado" do tipo "expense".',
      );
      expect(prisma.category.create).not.toHaveBeenCalled();
    });

    it('maps a racing P2002 from the unique index onto the same 409', async () => {
      prisma.category.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

      await expect(service.create(userId, { name: 'Mercado', type: 'expense' })).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('hides archived categories by default and returns the envelope', async () => {
      prisma.category.findMany.mockResolvedValue([baseCategory]);
      prisma.category.count.mockResolvedValue(1);

      const result = await service.findAll(userId, {});

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId, isActive: true }, skip: 0, take: 20 }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
    });

    it('includes archived categories when asked', async () => {
      prisma.category.findMany.mockResolvedValue([]);
      prisma.category.count.mockResolvedValue(0);

      await service.findAll(userId, { includeArchived: true });

      expect(prisma.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId } }));
    });

    it('filters by type', async () => {
      prisma.category.findMany.mockResolvedValue([]);
      prisma.category.count.mockResolvedValue(0);

      await service.findAll(userId, { type: 'income' });

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId, isActive: true, type: 'income' } }),
      );
    });
  });

  describe('findOne', () => {
    it('throws 404 when the category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws 404 — never 403 — for a category owned by someone else', async () => {
      prisma.category.findUnique.mockResolvedValue({ ...baseCategory, userId: 'other-user' });

      await expect(service.findOne(userId, categoryId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('only writes the keys present in the patch', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory);
      prisma.category.update.mockResolvedValue({ ...baseCategory, name: 'Supermercado' });

      const result = await service.update(userId, categoryId, { name: 'Supermercado' });

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: categoryId },
        data: { name: 'Supermercado' },
      });
      expect(result.name).toBe('Supermercado');
    });

    it('checks uniqueness against the FINAL state, excluding itself', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory);
      prisma.category.update.mockResolvedValue({ ...baseCategory, type: 'both' });

      await service.update(userId, categoryId, { type: 'both' });

      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { userId, name: 'Mercado', type: 'both', id: { not: categoryId } },
        select: { id: true },
      });
    });

    it('rejects changing the type when historical rows would become incompatible', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory);
      prisma.transaction.count.mockResolvedValue(1);

      await expect(service.update(userId, categoryId, { type: 'income' })).rejects.toThrow(ConflictException);

      expect(prisma.transaction.count).toHaveBeenCalledWith({
        where: { userId, categoryId, type: { not: 'income' } },
      });
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('does not re-check uniqueness when neither name nor type changes', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory);
      prisma.category.update.mockResolvedValue(baseCategory);

      await service.update(userId, categoryId, { name: 'Mercado' });

      expect(prisma.category.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a rename onto an existing (name, type) pair with a 409', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory);
      prisma.category.findFirst.mockResolvedValue({ id: 'category-2' });

      await expect(service.update(userId, categoryId, { name: 'Lazer' })).rejects.toThrow(ConflictException);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('throws 404 for a category owned by someone else', async () => {
      prisma.category.findUnique.mockResolvedValue({ ...baseCategory, userId: 'other-user' });

      await expect(service.update(userId, categoryId, { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('archives instead of deleting when transactions use the category', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory);
      withoutDependents();
      prisma.transaction.count.mockResolvedValue(7);
      prisma.category.update.mockResolvedValue({ ...baseCategory, isActive: false, archivedAt: updatedAt });

      const result = await service.remove(userId, categoryId);

      expect(prisma.category.delete).not.toHaveBeenCalled();
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: categoryId },
        data: { isActive: false, archivedAt: expect.any(Date) },
      });
      expect(result.isActive).toBe(false);
      expect(result.archivedAt).toBe(updatedAt.toISOString());
    });

    it('archives when only an occurrence snapshot references it', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory);
      withoutDependents();
      prisma.fixedTransactionOccurrence.count.mockResolvedValue(2);
      prisma.category.update.mockResolvedValue({ ...baseCategory, isActive: false, archivedAt: updatedAt });

      await service.remove(userId, categoryId);

      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it('hard-deletes only when nothing references the category', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory);
      withoutDependents();
      prisma.category.delete.mockResolvedValue(baseCategory);

      const result = await service.remove(userId, categoryId);

      expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: categoryId } });
      expect(prisma.category.update).not.toHaveBeenCalled();
      expect(result.id).toBe(categoryId);
    });

    it('throws 404 for a category owned by someone else', async () => {
      prisma.category.findUnique.mockResolvedValue({ ...baseCategory, userId: 'other-user' });

      await expect(service.remove(userId, categoryId)).rejects.toThrow(NotFoundException);
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });
  });

  describe('archive / restore', () => {
    it('archives an active category', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory);
      prisma.category.update.mockResolvedValue({ ...baseCategory, isActive: false, archivedAt: updatedAt });

      const result = await service.archive(userId, categoryId);

      expect(result.isActive).toBe(false);
    });

    it('is idempotent when already archived', async () => {
      prisma.category.findUnique.mockResolvedValue({ ...baseCategory, isActive: false, archivedAt: updatedAt });

      await service.archive(userId, categoryId);

      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('restores an archived category and clears archivedAt', async () => {
      prisma.category.findUnique.mockResolvedValue({ ...baseCategory, isActive: false, archivedAt: updatedAt });
      prisma.category.update.mockResolvedValue(baseCategory);

      const result = await service.restore(userId, categoryId);

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: categoryId },
        data: { isActive: true, archivedAt: null },
      });
      expect(result.archivedAt).toBeNull();
    });
  });
});
