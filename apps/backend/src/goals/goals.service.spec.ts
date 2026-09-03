import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { createMockPrismaService, type MockedPrismaService } from '../prisma/prisma.mock';
import { PrismaService } from '../prisma/prisma.service';
import { computeProgress, GoalsService } from './goals.service';

/**
 * Goals carry **manual** progress. These tests pin the clamp (progress used to
 * run past 100%), the `'manual'` label, and the fact that the two related ids
 * are ownership-checked labels that never influence the number.
 */
describe('GoalsService', () => {
  let service: GoalsService;
  let prisma: MockedPrismaService;

  const userA = 'user-a';
  const userB = 'user-b';
  const goalId = 'goal-1';
  const accountId = 'account-1';
  const categoryId = 'category-1';

  const goalRow = {
    id: goalId,
    userId: userA,
    name: 'Reserva de emergência',
    type: 'saving',
    targetAmount: '15000.00',
    currentAmount: '5000.00',
    deadline: new Date('2026-12-31T00:00:00.000Z'),
    relatedCategoryId: null,
    relatedAccountId: null,
    createdAt: new Date('2026-01-10T12:00:00.000Z'),
    updatedAt: new Date('2026-01-11T12:00:00.000Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoalsService, { provide: PrismaService, useValue: createMockPrismaService() }],
    }).compile();

    service = module.get(GoalsService);
    prisma = module.get(PrismaService) as unknown as MockedPrismaService;
  });

  afterEach(() => jest.clearAllMocks());

  describe('computeProgress', () => {
    it('rounds the ratio to 4 decimal places', () => {
      expect(computeProgress(5000, 15000)).toBe(0.3333);
    });

    it('clamps an overshoot to 1 instead of reporting more than 100%', () => {
      expect(computeProgress(30000, 15000)).toBe(1);
    });

    it('clamps a negative accumulation to 0', () => {
      expect(computeProgress(-100, 15000)).toBe(0);
    });

    it('returns 0 for a non-positive target instead of dividing by zero', () => {
      expect(computeProgress(500, 0)).toBe(0);
    });
  });

  describe('create', () => {
    it('defaults currentAmount to 0 and converts the deadline to a civil date', async () => {
      prisma.goal.create.mockResolvedValue({ ...goalRow, currentAmount: '0.00' });

      const result = await service.create(userA, {
        name: 'Reserva de emergência',
        type: 'saving',
        targetAmount: 15000,
        deadline: '2026-12-31',
      });

      expect(prisma.goal.create).toHaveBeenCalledWith({
        data: {
          userId: userA,
          name: 'Reserva de emergência',
          type: 'saving',
          targetAmount: 15000,
          currentAmount: 0,
          deadline: new Date('2026-12-31T00:00:00.000Z'),
          relatedCategoryId: null,
          relatedAccountId: null,
        },
      });
      expect(result.deadline).toBe('2026-12-31');
      expect(result.currentAmount).toBe(0);
      expect(result.progress).toBe(0);
      expect(result.progressSource).toBe('manual');
    });

    it('stores a null deadline when none is given', async () => {
      prisma.goal.create.mockResolvedValue({ ...goalRow, deadline: null });

      const result = await service.create(userA, { name: 'Carro', type: 'other', targetAmount: 50000 });

      expect(prisma.goal.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deadline: null }) }),
      );
      expect(result.deadline).toBeNull();
    });

    it('rejects a deadline that is not a real calendar day', async () => {
      await expect(
        service.create(userA, { name: 'Carro', type: 'other', targetAmount: 100, deadline: '2026-02-30' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.goal.create).not.toHaveBeenCalled();
    });

    it('accepts related ids that belong to the caller', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId, userId: userA });
      prisma.account.findUnique.mockResolvedValue({ id: accountId, userId: userA });
      prisma.goal.create.mockResolvedValue({ ...goalRow, relatedCategoryId: categoryId, relatedAccountId: accountId });

      const result = await service.create(userA, {
        name: 'Reserva',
        type: 'saving',
        targetAmount: 15000,
        relatedCategoryId: categoryId,
        relatedAccountId: accountId,
      });

      expect(result.relatedCategoryId).toBe(categoryId);
      expect(result.relatedAccountId).toBe(accountId);
    });

    it('rejects a related account owned by somebody else with 404', async () => {
      prisma.account.findUnique.mockResolvedValue({ id: accountId, userId: userB });

      await expect(
        service.create(userA, { name: 'Reserva', type: 'saving', targetAmount: 100, relatedAccountId: accountId }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.goal.create).not.toHaveBeenCalled();
    });

    it('rejects a related category owned by somebody else with 404', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId, userId: userB });

      await expect(
        service.create(userA, { name: 'Reserva', type: 'saving', targetAmount: 100, relatedCategoryId: categoryId }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.goal.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns the paginated envelope with progress on every row', async () => {
      prisma.goal.findMany.mockResolvedValue([goalRow]);
      prisma.goal.count.mockResolvedValue(1);

      const result = await service.findAll(userA, { page: 1, limit: 20 });

      expect(prisma.goal.findMany).toHaveBeenCalledWith({
        where: { userId: userA },
        skip: 0,
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      expect(result.data[0].progress).toBe(0.3333);
      expect(result.data[0].progressSource).toBe('manual');
      expect(result.meta.totalItems).toBe(1);
    });

    it('never returns a bare array', async () => {
      prisma.goal.findMany.mockResolvedValue([]);
      prisma.goal.count.mockResolvedValue(0);

      const result = await service.findAll(userA);

      expect(Array.isArray(result)).toBe(false);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });
  });

  describe('findOne', () => {
    it('returns the contract shape, money as numbers', async () => {
      prisma.goal.findUnique.mockResolvedValue(goalRow);

      const result = await service.findOne(userA, goalId);

      expect(result).toEqual({
        id: goalId,
        name: 'Reserva de emergência',
        type: 'saving',
        targetAmount: 15000,
        currentAmount: 5000,
        deadline: '2026-12-31',
        relatedCategoryId: null,
        relatedAccountId: null,
        progress: 0.3333,
        progressSource: 'manual',
        createdAt: '2026-01-10T12:00:00.000Z',
        updatedAt: '2026-01-11T12:00:00.000Z',
      });
    });

    it('throws 404 when it does not exist', async () => {
      prisma.goal.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userA, goalId)).rejects.toThrow(NotFoundException);
    });

    it('throws 404 — never 403 — for another user’s goal', async () => {
      prisma.goal.findUnique.mockResolvedValue({ ...goalRow, userId: userB });

      await expect(service.findOne(userA, goalId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('leaves omitted keys untouched', async () => {
      prisma.goal.findUnique.mockResolvedValue(goalRow);
      prisma.goal.update.mockResolvedValue({ ...goalRow, name: 'Nova reserva' });

      await service.update(userA, goalId, { name: 'Nova reserva' });

      expect(prisma.goal.update).toHaveBeenCalledWith({ where: { id: goalId }, data: { name: 'Nova reserva' } });
    });

    it('clears the deadline on an explicit null', async () => {
      prisma.goal.findUnique.mockResolvedValue(goalRow);
      prisma.goal.update.mockResolvedValue({ ...goalRow, deadline: null });

      const result = await service.update(userA, goalId, { deadline: null });

      expect(prisma.goal.update).toHaveBeenCalledWith({ where: { id: goalId }, data: { deadline: null } });
      expect(result.deadline).toBeNull();
    });

    it('clears both related ids on explicit nulls without any ownership lookup', async () => {
      prisma.goal.findUnique.mockResolvedValue(goalRow);
      prisma.goal.update.mockResolvedValue(goalRow);

      await service.update(userA, goalId, { relatedAccountId: null, relatedCategoryId: null });

      expect(prisma.goal.update).toHaveBeenCalledWith({
        where: { id: goalId },
        data: { relatedCategoryId: null, relatedAccountId: null },
      });
      expect(prisma.account.findUnique).not.toHaveBeenCalled();
      expect(prisma.category.findUnique).not.toHaveBeenCalled();
    });

    it('checks ownership before attaching a related account', async () => {
      prisma.goal.findUnique.mockResolvedValue(goalRow);
      prisma.account.findUnique.mockResolvedValue({ id: accountId, userId: userB });

      await expect(service.update(userA, goalId, { relatedAccountId: accountId })).rejects.toThrow(NotFoundException);
      expect(prisma.goal.update).not.toHaveBeenCalled();
    });

    it('clamps the recomputed progress after an overshooting currentAmount', async () => {
      prisma.goal.findUnique.mockResolvedValue(goalRow);
      prisma.goal.update.mockResolvedValue({ ...goalRow, currentAmount: '30000.00' });

      const result = await service.update(userA, goalId, { currentAmount: 30000 });

      expect(result.progress).toBe(1);
      expect(result.currentAmount).toBe(30000);
    });

    it('refuses to touch another user’s goal', async () => {
      prisma.goal.findUnique.mockResolvedValue({ ...goalRow, userId: userB });

      await expect(service.update(userA, goalId, { name: 'x' })).rejects.toThrow(NotFoundException);
      expect(prisma.goal.update).not.toHaveBeenCalled();
    });
  });

  describe('updateProgress', () => {
    it('patches only currentAmount and returns the recomputed progress', async () => {
      prisma.goal.findUnique.mockResolvedValue(goalRow);
      prisma.goal.update.mockResolvedValue({ ...goalRow, currentAmount: '7500.00' });

      const result = await service.updateProgress(userA, goalId, 7500);

      expect(prisma.goal.update).toHaveBeenCalledWith({ where: { id: goalId }, data: { currentAmount: 7500 } });
      expect(result.progress).toBe(0.5);
      expect(result.progressSource).toBe('manual');
    });

    it('throws 404 for another user’s goal', async () => {
      prisma.goal.findUnique.mockResolvedValue({ ...goalRow, userId: userB });

      await expect(service.updateProgress(userA, goalId, 100)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes a goal owned by the caller', async () => {
      prisma.goal.findUnique.mockResolvedValue(goalRow);
      prisma.goal.delete.mockResolvedValue(goalRow);

      await service.remove(userA, goalId);

      expect(prisma.goal.delete).toHaveBeenCalledWith({ where: { id: goalId } });
    });

    it('throws 404 for another user’s goal', async () => {
      prisma.goal.findUnique.mockResolvedValue({ ...goalRow, userId: userB });

      await expect(service.remove(userA, goalId)).rejects.toThrow(NotFoundException);
      expect(prisma.goal.delete).not.toHaveBeenCalled();
    });
  });
});
