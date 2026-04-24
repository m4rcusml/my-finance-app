import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto, GoalType, UpdateGoalDto } from './goals.dto';
import { GoalsService } from './goals.service';

describe('GoalsService', () => {
  let service: GoalsService;
  let prisma: jest.Mocked<PrismaService>;
  let accountsService: jest.Mocked<AccountsService>;
  let categoriesService: jest.Mocked<CategoriesService>;

  const userId = 'user-1';
  const goalId = 'goal-1';

  const baseGoal = {
    id: goalId,
    userId,
    name: 'Viagem Japão',
    type: 'purchase',
    targetAmount: 15000,
    currentAmount: 5000,
    deadline: new Date('2025-12-31'),
    relatedCategoryId: null,
    relatedAccountId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        {
          provide: PrismaService,
          useValue: {
            goal: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: AccountsService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: CategoriesService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
    prisma = module.get(PrismaService);
    accountsService = module.get(AccountsService);
    categoriesService = module.get(CategoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createGoal', () => {
    it('should create a goal for the user', async () => {
      const dto: CreateGoalDto = {
        name: 'Viagem Japão',
        type: GoalType.PURCHASE,
        targetAmount: 15000,
        currentAmount: 5000,
        deadline: '2025-12-31',
      };
      prisma.goal.create.mockResolvedValue(baseGoal as any);

      const result = await service.createGoal(userId, dto);

      expect(prisma.goal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: dto.name,
          type: dto.type,
          targetAmount: dto.targetAmount,
          currentAmount: dto.currentAmount,
          userId,
        }),
      });
      expect(result.name).toBe('Viagem Japão');
    });

    it('should default currentAmount to 0 when not provided', async () => {
      const dto: CreateGoalDto = {
        name: 'Emergency Fund',
        type: GoalType.SAVINGS,
        targetAmount: 10000,
      };
      prisma.goal.create.mockResolvedValue({ ...baseGoal, ...dto, currentAmount: 0 } as any);

      const result = await service.createGoal(userId, dto);

      expect(prisma.goal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentAmount: 0 }),
        }),
      );
    });

    it('should validate relatedAccount when provided', async () => {
      const dto: CreateGoalDto = {
        name: 'Viagem Japão',
        type: GoalType.PURCHASE,
        targetAmount: 15000,
        relatedAccountId: 'account-1',
      };
      accountsService.findById.mockResolvedValue({ id: 'account-1', userId } as any);
      prisma.goal.create.mockResolvedValue({ ...baseGoal, relatedAccountId: 'account-1' } as any);

      const result = await service.createGoal(userId, dto);

      expect(accountsService.findById).toHaveBeenCalledWith(userId, 'account-1');
      expect(result.relatedAccountId).toBe('account-1');
    });

    it('should validate relatedCategory when provided', async () => {
      const dto: CreateGoalDto = {
        name: 'Viagem Japão',
        type: GoalType.PURCHASE,
        targetAmount: 15000,
        relatedCategoryId: 'category-1',
      };
      categoriesService.findById.mockResolvedValue({ id: 'category-1', userId } as any);
      prisma.goal.create.mockResolvedValue({ ...baseGoal, relatedCategoryId: 'category-1' } as any);

      const result = await service.createGoal(userId, dto);

      expect(categoriesService.findById).toHaveBeenCalledWith(userId, 'category-1');
      expect(result.relatedCategoryId).toBe('category-1');
    });

    it('should throw BadRequestException when relatedAccount validation fails', async () => {
      const dto: CreateGoalDto = {
        name: 'Viagem Japão',
        type: GoalType.PURCHASE,
        targetAmount: 15000,
        relatedAccountId: 'account-1',
      };
      accountsService.findById.mockRejectedValue(new ForbiddenException());

      await expect(service.createGoal(userId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllByUser', () => {
    it('should return all goals for the user with progress', async () => {
      prisma.goal.findMany.mockResolvedValue([baseGoal]);
      prisma.goal.count.mockResolvedValue(1);

      const result = await service.findAllByUser(userId, 1, 20);

      expect(prisma.goal.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId } }));
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Viagem Japão');
      expect(result.data[0].progress).toBeCloseTo(0.3333, 3);
      expect(result.meta.totalItems).toBe(1);
    });

    it('should handle goals with zero targetAmount gracefully', async () => {
      prisma.goal.findMany.mockResolvedValue([{ ...baseGoal, targetAmount: 0 }]);
      prisma.goal.count.mockResolvedValue(1);

      const result = await service.findAllByUser(userId, 1, 20);

      expect(result.data[0].progress).toBe(0);
      expect(result.meta.totalItems).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return goal with progress when found and owned', async () => {
      prisma.goal.findUnique.mockResolvedValue(baseGoal);

      const result = await service.findById(userId, goalId);

      expect(result.id).toBe(goalId);
      expect(result.progress).toBeCloseTo(0.3333, 3);
    });

    it('should throw NotFoundException when goal does not exist', async () => {
      prisma.goal.findUnique.mockResolvedValue(null);

      await expect(service.findById(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when goal belongs to another user', async () => {
      prisma.goal.findUnique.mockResolvedValue({ ...baseGoal, userId: 'other-user' });

      await expect(service.findById(userId, goalId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateGoal', () => {
    it('should update goal when owned', async () => {
      const dto: UpdateGoalDto = { name: 'Viagem Europa' };
      prisma.goal.findUnique.mockResolvedValue(baseGoal);
      prisma.goal.update.mockResolvedValue({ ...baseGoal, ...dto });

      const result = await service.updateGoal(userId, goalId, dto);

      expect(prisma.goal.update).toHaveBeenCalledWith({
        data: dto,
        where: { id: goalId },
      });
      expect(result.name).toBe('Viagem Europa');
    });

    it('should validate relatedAccount when provided in update', async () => {
      const dto: UpdateGoalDto = { relatedAccountId: 'account-2' };
      prisma.goal.findUnique.mockResolvedValue(baseGoal);
      accountsService.findById.mockResolvedValue({ id: 'account-2', userId } as any);
      prisma.goal.update.mockResolvedValue({ ...baseGoal, relatedAccountId: 'account-2' });

      const result = await service.updateGoal(userId, goalId, dto);

      expect(accountsService.findById).toHaveBeenCalledWith(userId, 'account-2');
      expect(result.relatedAccountId).toBe('account-2');
    });

    it('should throw NotFoundException when goal does not exist', async () => {
      prisma.goal.findUnique.mockResolvedValue(null);

      await expect(service.updateGoal(userId, goalId, {})).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when updating another user goal', async () => {
      prisma.goal.findUnique.mockResolvedValue({ ...baseGoal, userId: 'other-user' });

      await expect(service.updateGoal(userId, goalId, {})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteGoal', () => {
    it('should delete goal when owned', async () => {
      prisma.goal.findUnique.mockResolvedValue(baseGoal);
      prisma.goal.delete.mockResolvedValue(baseGoal);

      await service.deleteGoal(userId, goalId);

      expect(prisma.goal.delete).toHaveBeenCalledWith({ where: { id: goalId } });
    });

    it('should throw NotFoundException when goal does not exist', async () => {
      prisma.goal.findUnique.mockResolvedValue(null);

      await expect(service.deleteGoal(userId, goalId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when deleting another user goal', async () => {
      prisma.goal.findUnique.mockResolvedValue({ ...baseGoal, userId: 'other-user' });

      await expect(service.deleteGoal(userId, goalId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('enrichWithProgress', () => {
    it('should calculate progress correctly', () => {
      // @ts-expect-error accessing private method for testing
      const result = service.enrichWithProgress({ ...baseGoal, currentAmount: 5000, targetAmount: 15000 });
      expect(result.progress).toBeCloseTo(0.3333, 3);
    });

    it('should return 0 when targetAmount is 0', () => {
      // @ts-expect-error accessing private method for testing
      const result = service.enrichWithProgress({ ...baseGoal, currentAmount: 100, targetAmount: 0 });
      expect(result.progress).toBe(0);
    });

    it('should handle Decimal-like values', () => {
      // @ts-expect-error accessing private method for testing
      const result = service.enrichWithProgress({
        ...baseGoal,
        currentAmount: { toNumber: () => 2500 },
        targetAmount: { toNumber: () => 10000 },
      });
      expect(result.progress).toBe(0.25);
    });
  });
});
