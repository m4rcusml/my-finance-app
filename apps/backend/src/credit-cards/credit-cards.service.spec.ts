import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { createMockPrismaService, type MockedPrismaService } from '../prisma/prisma.mock';
import { PrismaService } from '../prisma/prisma.service';
import { CreditCardsService } from './credit-cards.service';

describe('CreditCardsService', () => {
  let service: CreditCardsService;
  let prisma: MockedPrismaService;

  const userId = 'user-1';
  const cardId = 'card-1';
  const createdAt = new Date('2026-01-10T12:00:00.000Z');
  const updatedAt = new Date('2026-01-11T12:00:00.000Z');

  /** 2026-03-15 09:00 in America/Sao_Paulo — safely inside the civil day. */
  const NOW = new Date('2026-03-15T12:00:00.000Z');

  const baseCard = {
    id: cardId,
    userId,
    name: 'Cartão Inter',
    institution: 'Banco Inter',
    limitTotal: 5000,
    closingDay: 10,
    isActive: true,
    archivedAt: null,
    createdAt,
    updatedAt,
  };

  function withoutDependents() {
    prisma.transaction.count.mockResolvedValue(0);
    prisma.fixedTransaction.count.mockResolvedValue(0);
    prisma.fixedTransactionOccurrence.count.mockResolvedValue(0);
  }

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditCardsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('America/Sao_Paulo') } },
      ],
    }).compile();

    service = module.get(CreditCardsService);
    prisma.transaction.groupBy.mockResolvedValue([]);
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('counts only the expenses of the current open cycle, not the whole history', async () => {
      prisma.creditCard.findMany.mockResolvedValue([baseCard]);
      prisma.creditCard.count.mockResolvedValue(1);
      prisma.transaction.groupBy.mockResolvedValue([{ creditCardId: cardId, _sum: { value: 1200.5 } }]);

      const result = await service.findAll(userId, {});

      // Today is the 15th and the card closes on the 10th, so the open cycle
      // runs 11 Mar -> 10 Apr.
      expect(result.data[0].currentCycle).toEqual({ start: '2026-03-11', end: '2026-04-10' });
      expect(result.data[0].cycleUsedAmount).toBe(1200.5);
      expect(result.data[0].availableAmount).toBe(3799.5);
      expect(result.data[0]).not.toHaveProperty('transactions');
      expect(result.meta.totalItems).toBe(1);

      expect(prisma.transaction.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
        by: ['creditCardId'],
        where: {
          userId,
          type: 'expense',
          OR: [
            {
              creditCardId: cardId,
              date: { gte: new Date('2026-03-11T00:00:00.000Z'), lt: new Date('2026-04-11T00:00:00.000Z') },
            },
          ],
        },
        _sum: { value: true },
      });
      expect(prisma.creditCard.findMany.mock.calls[0][0]).not.toHaveProperty('include');
    });

    it('falls back to the calendar month when closingDay is null', async () => {
      prisma.creditCard.findMany.mockResolvedValue([{ ...baseCard, closingDay: null }]);
      prisma.creditCard.count.mockResolvedValue(1);

      const result = await service.findAll(userId, {});

      expect(result.data[0].currentCycle).toEqual({ start: '2026-03-01', end: '2026-03-31' });
      expect(result.data[0].cycleUsedAmount).toBe(0);
      expect(result.data[0].availableAmount).toBe(5000);
    });

    it('lets availableAmount go negative when the cycle is over the limit', async () => {
      prisma.creditCard.findMany.mockResolvedValue([baseCard]);
      prisma.creditCard.count.mockResolvedValue(1);
      prisma.transaction.groupBy.mockResolvedValue([{ creditCardId: cardId, _sum: { value: 6000 } }]);

      const result = await service.findAll(userId, {});

      expect(result.data[0].availableAmount).toBe(-1000);
    });

    it('hides archived cards by default and includes them on request', async () => {
      prisma.creditCard.findMany.mockResolvedValue([]);
      prisma.creditCard.count.mockResolvedValue(0);

      await service.findAll(userId, {});
      expect(prisma.creditCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId, isActive: true } }),
      );

      await service.findAll(userId, { includeArchived: true });
      expect(prisma.creditCard.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { userId } }));

      // Empty page: nothing to aggregate.
      expect(prisma.transaction.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the contract shape', async () => {
      prisma.creditCard.findUnique.mockResolvedValue(baseCard);

      const result = await service.findOne(userId, cardId);

      expect(result).toEqual({
        id: cardId,
        name: 'Cartão Inter',
        institution: 'Banco Inter',
        limitTotal: 5000,
        closingDay: 10,
        cycleUsedAmount: 0,
        availableAmount: 5000,
        currentCycle: { start: '2026-03-11', end: '2026-04-10' },
        isActive: true,
        archivedAt: null,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
    });

    it('throws 404 when missing', async () => {
      prisma.creditCard.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws 404 — never 403 — for a card owned by someone else', async () => {
      prisma.creditCard.findUnique.mockResolvedValue({ ...baseCard, userId: 'other-user' });

      await expect(service.findOne(userId, cardId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('returns the same shape as GET, cycle included', async () => {
      prisma.creditCard.create.mockResolvedValue(baseCard);

      const result = await service.create(userId, {
        name: 'Cartão Inter',
        institution: 'Banco Inter',
        limitTotal: 5000,
        closingDay: 10,
      });

      expect(prisma.creditCard.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: 'Cartão Inter',
          institution: 'Banco Inter',
          limitTotal: 5000,
          closingDay: 10,
        },
      });
      expect(result.currentCycle).toEqual({ start: '2026-03-11', end: '2026-04-10' });
      expect(result.cycleUsedAmount).toBe(0);
      expect(result.availableAmount).toBe(5000);
    });

    it('stores a null closingDay when it is omitted', async () => {
      prisma.creditCard.create.mockResolvedValue({ ...baseCard, closingDay: null });

      await service.create(userId, { name: 'X', institution: 'Y', limitTotal: 100 });

      expect(prisma.creditCard.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ closingDay: null }) }),
      );
    });
  });

  describe('update', () => {
    it('leaves omitted keys untouched', async () => {
      prisma.creditCard.findUnique.mockResolvedValue(baseCard);
      prisma.creditCard.update.mockResolvedValue({ ...baseCard, name: 'Cartão Nubank' });

      const result = await service.update(userId, cardId, { name: 'Cartão Nubank' });

      expect(prisma.creditCard.update).toHaveBeenCalledWith({
        where: { id: cardId },
        data: { name: 'Cartão Nubank' },
      });
      // Same shape as GET — the old PATCH returned a different one.
      expect(result.currentCycle).toEqual({ start: '2026-03-11', end: '2026-04-10' });
      expect(result).toHaveProperty('cycleUsedAmount');
      expect(result).toHaveProperty('availableAmount');
    });

    it('clears closingDay when it is explicitly null', async () => {
      prisma.creditCard.findUnique.mockResolvedValue(baseCard);
      prisma.creditCard.update.mockResolvedValue({ ...baseCard, closingDay: null });

      const result = await service.update(userId, cardId, { closingDay: null });

      expect(prisma.creditCard.update).toHaveBeenCalledWith({
        where: { id: cardId },
        data: { closingDay: null },
      });
      expect(result.closingDay).toBeNull();
      expect(result.currentCycle).toEqual({ start: '2026-03-01', end: '2026-03-31' });
    });

    it('throws 404 for a card owned by someone else', async () => {
      prisma.creditCard.findUnique.mockResolvedValue({ ...baseCard, userId: 'other-user' });

      await expect(service.update(userId, cardId, { name: 'x' })).rejects.toThrow(NotFoundException);
      expect(prisma.creditCard.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('archives instead of deleting when the card has history', async () => {
      prisma.creditCard.findUnique.mockResolvedValue(baseCard);
      withoutDependents();
      prisma.transaction.count.mockResolvedValue(5);
      prisma.creditCard.update.mockResolvedValue({ ...baseCard, isActive: false, archivedAt: updatedAt });

      const result = await service.remove(userId, cardId);

      expect(prisma.creditCard.delete).not.toHaveBeenCalled();
      expect(prisma.creditCard.update).toHaveBeenCalledWith({
        where: { id: cardId },
        data: { isActive: false, archivedAt: expect.any(Date) },
      });
      expect(result.isActive).toBe(false);
      expect(result.archivedAt).toBe(updatedAt.toISOString());
    });

    it('hard-deletes only when nothing references the card', async () => {
      prisma.creditCard.findUnique.mockResolvedValue(baseCard);
      withoutDependents();
      prisma.creditCard.delete.mockResolvedValue(baseCard);

      await service.remove(userId, cardId);

      expect(prisma.creditCard.delete).toHaveBeenCalledWith({ where: { id: cardId } });
      expect(prisma.creditCard.update).not.toHaveBeenCalled();
    });
  });

  describe('archive / restore', () => {
    it('archives an active card', async () => {
      prisma.creditCard.findUnique.mockResolvedValue(baseCard);
      prisma.creditCard.update.mockResolvedValue({ ...baseCard, isActive: false, archivedAt: updatedAt });

      const result = await service.archive(userId, cardId);

      expect(result.isActive).toBe(false);
    });

    it('is idempotent when already archived', async () => {
      prisma.creditCard.findUnique.mockResolvedValue({ ...baseCard, isActive: false, archivedAt: updatedAt });

      await service.archive(userId, cardId);

      expect(prisma.creditCard.update).not.toHaveBeenCalled();
    });

    it('restores an archived card and clears archivedAt', async () => {
      prisma.creditCard.findUnique.mockResolvedValue({ ...baseCard, isActive: false, archivedAt: updatedAt });
      prisma.creditCard.update.mockResolvedValue(baseCard);

      const result = await service.restore(userId, cardId);

      expect(prisma.creditCard.update).toHaveBeenCalledWith({
        where: { id: cardId },
        data: { isActive: true, archivedAt: null },
      });
      expect(result.archivedAt).toBeNull();
    });
  });

  describe('getCycleTotals', () => {
    it('sums limits and current-cycle usage with one complete read and one aggregate', async () => {
      prisma.creditCard.findMany.mockResolvedValue([
        { id: 'card-1', limitTotal: 5000, closingDay: 10 },
        { id: 'card-2', limitTotal: 2000, closingDay: null },
      ]);
      prisma.transaction.groupBy.mockResolvedValue([
        { creditCardId: 'card-1', _sum: { value: 1200.5 } },
        { creditCardId: 'card-2', _sum: { value: 300 } },
      ]);

      const result = await service.getCycleTotals(userId);

      expect(result).toEqual({ totalLimit: 7000, totalUsed: 1500.5, totalAvailable: 5499.5 });
      expect(prisma.transaction.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.creditCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId, isActive: true } }),
      );
      expect(prisma.creditCard.findMany.mock.calls[0][0]).not.toHaveProperty('take');
      // Each card gets its own window: the 10th-closing card and the calendar-month one.
      const call = prisma.transaction.groupBy.mock.calls[0][0];
      expect(call.where.OR).toEqual([
        {
          creditCardId: 'card-1',
          date: { gte: new Date('2026-03-11T00:00:00.000Z'), lt: new Date('2026-04-11T00:00:00.000Z') },
        },
        {
          creditCardId: 'card-2',
          date: { gte: new Date('2026-03-01T00:00:00.000Z'), lt: new Date('2026-04-01T00:00:00.000Z') },
        },
      ]);
    });

    it('returns zeros when the user has no active cards', async () => {
      prisma.creditCard.findMany.mockResolvedValue([]);

      await expect(service.getCycleTotals(userId)).resolves.toEqual({
        totalLimit: 0,
        totalUsed: 0,
        totalAvailable: 0,
      });
      expect(prisma.transaction.groupBy).not.toHaveBeenCalled();
    });

    it('does not truncate totals when the user has more than 200 active cards', async () => {
      prisma.creditCard.findMany.mockResolvedValue(
        Array.from({ length: 201 }, (_, index) => ({
          id: `card-${index}`,
          limitTotal: 100,
          closingDay: null,
        })),
      );

      await expect(service.getCycleTotals(userId)).resolves.toEqual({
        totalLimit: 20100,
        totalUsed: 0,
        totalAvailable: 20100,
      });
      expect(prisma.creditCard.findMany.mock.calls[0][0]).not.toHaveProperty('take');
    });
  });
});
