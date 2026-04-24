import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: jest.Mocked<PrismaService>;

  const userId = 'user-1';
  const categoryId = 'category-1';

  const baseCategory = {
    id: categoryId,
    userId,
    name: 'Food',
    type: 'expense' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: {
            category: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            transaction: {
              count: jest.fn(),
            },
            fixedTransaction: {
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a category for the user', async () => {
      const dto: CreateCategoryDto = { name: 'Salary', type: 'income' };
      prisma.category.create.mockResolvedValue({ ...baseCategory, ...dto });

      const result = await service.create(userId, dto);

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { ...dto, userId },
      });
      expect(result.name).toBe('Salary');
    });
  });

  describe('findAll', () => {
    it('should return all categories for the user', async () => {
      prisma.category.findMany.mockResolvedValue([baseCategory]);

      const result = await service.findAll(userId);

      expect(prisma.category.findMany).toHaveBeenCalledWith({ where: { userId } });
      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return category when found and owned', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory);

      const result = await service.findById(userId, categoryId);

      expect(result.id).toBe(categoryId);
    });

    it('should throw NotFoundException when category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findById(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when category belongs to another user', async () => {
      prisma.category.findUnique.mockResolvedValue({ ...baseCategory, userId: 'other-user' });

      await expect(service.findById(userId, categoryId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update category when owned', async () => {
      const dto: UpdateCategoryDto = { name: 'Updated Food' };
      prisma.category.findUnique.mockResolvedValue(baseCategory);
      prisma.category.update.mockResolvedValue({ ...baseCategory, ...dto });

      const result = await service.update(userId, categoryId, dto);

      expect(prisma.category.update).toHaveBeenCalledWith({
        data: dto,
        where: { id: categoryId },
      });
      expect(result.name).toBe('Updated Food');
    });

    it('should throw NotFoundException when category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.update(userId, categoryId, {})).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when updating another user category', async () => {
      prisma.category.findUnique.mockResolvedValue({ ...baseCategory, userId: 'other-user' });

      await expect(service.update(userId, categoryId, {})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('should delete category when owned and no dependent transactions', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory);
      prisma.transaction.count.mockResolvedValue(0);
      prisma.fixedTransaction.count.mockResolvedValue(0);
      prisma.category.delete.mockResolvedValue(baseCategory);

      await service.delete(userId, categoryId);

      expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: categoryId } });
    });

    // This test documents the expected behavior once dependency check is implemented
    it.skip('should block deletion when category has dependent transactions', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory);
      prisma.transaction.count.mockResolvedValue(5);

      await expect(service.delete(userId, categoryId)).rejects.toThrow('Cannot delete category with existing transactions');
    });

    it('should throw NotFoundException when category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.delete(userId, categoryId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when deleting another user category', async () => {
      prisma.category.findUnique.mockResolvedValue({ ...baseCategory, userId: 'other-user' });

      await expect(service.delete(userId, categoryId)).rejects.toThrow(ForbiddenException);
    });
  });
});
