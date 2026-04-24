import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvestmentDto, InvestmentType, UpdateInvestmentDto } from './investments.dto';
import { InvestmentsService } from './investments.service';

describe('InvestmentsService', () => {
  let service: InvestmentsService;
  let prisma: jest.Mocked<PrismaService>;

  const userId = 'user-1';
  const investmentId = 'investment-1';

  const baseInvestment = {
    id: investmentId,
    userId,
    marketAssetId: null,
    broker: 'XP Investimentos',
    type: 'stock',
    quantity: 100,
    buyPrice: 50.5,
    investedAmount: 5050,
    buyDate: new Date('2024-01-15'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentsService,
        {
          provide: PrismaService,
          useValue: {
            investment: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            marketAsset: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<InvestmentsService>(InvestmentsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createInvestment', () => {
    it('should create an investment for the user', async () => {
      const dto: CreateInvestmentDto = {
        broker: 'XP Investimentos',
        type: InvestmentType.STOCK,
        quantity: 100,
        buyPrice: 50.5,
        investedAmount: 5050,
        buyDate: '2024-01-15',
      };
      prisma.investment.create.mockResolvedValue(baseInvestment as any);

      const result = await service.createInvestment(userId, dto);

      expect(prisma.investment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          broker: dto.broker,
          type: dto.type,
          quantity: dto.quantity,
          buyPrice: dto.buyPrice,
          investedAmount: dto.investedAmount,
          userId,
        }),
      });
      expect(result.broker).toBe('XP Investimentos');
    });

    it('should create investment with marketAssetId when asset exists', async () => {
      const dto: CreateInvestmentDto = {
        broker: 'XP Investimentos',
        type: InvestmentType.STOCK,
        quantity: 100,
        buyPrice: 50.5,
        investedAmount: 5050,
        buyDate: '2024-01-15',
        marketAssetId: 'asset-1',
      };
      prisma.marketAsset.findUnique.mockResolvedValue({ id: 'asset-1' } as any);
      prisma.investment.create.mockResolvedValue({ ...baseInvestment, marketAssetId: 'asset-1' } as any);

      const result = await service.createInvestment(userId, dto);

      expect(prisma.marketAsset.findUnique).toHaveBeenCalledWith({ where: { id: 'asset-1' } });
      expect(result.marketAssetId).toBe('asset-1');
    });

    it('should throw BadRequestException when investedAmount does not match quantity * buyPrice', async () => {
      const dto: CreateInvestmentDto = {
        broker: 'XP Investimentos',
        type: InvestmentType.STOCK,
        quantity: 100,
        buyPrice: 50.5,
        investedAmount: 5000,
        buyDate: '2024-01-15',
      };

      await expect(service.createInvestment(userId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when marketAssetId does not exist', async () => {
      const dto: CreateInvestmentDto = {
        broker: 'XP Investimentos',
        type: InvestmentType.STOCK,
        quantity: 100,
        buyPrice: 50.5,
        investedAmount: 5050,
        buyDate: '2024-01-15',
        marketAssetId: 'nonexistent',
      };
      prisma.marketAsset.findUnique.mockResolvedValue(null);

      await expect(service.createInvestment(userId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllByUser', () => {
    it('should return all investments for the user', async () => {
      prisma.investment.findMany.mockResolvedValue([baseInvestment]);
      prisma.investment.count.mockResolvedValue(1);

      const result = await service.findAllByUser(userId, 1, 20);

      expect(prisma.investment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId } }));
      expect(result.data).toHaveLength(1);
      expect(result.data[0].broker).toBe('XP Investimentos');
      expect(result.meta.totalItems).toBe(1);
    });

    it('should return empty array when user has no investments', async () => {
      prisma.investment.findMany.mockResolvedValue([]);
      prisma.investment.count.mockResolvedValue(0);

      const result = await service.findAllByUser(userId, 1, 20);

      expect(result.data).toHaveLength(0);
      expect(result.meta.totalItems).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return investment when found and owned', async () => {
      prisma.investment.findUnique.mockResolvedValue(baseInvestment);

      const result = await service.findById(userId, investmentId);

      expect(result.id).toBe(investmentId);
      expect(result.broker).toBe('XP Investimentos');
    });

    it('should throw NotFoundException when investment does not exist', async () => {
      prisma.investment.findUnique.mockResolvedValue(null);

      await expect(service.findById(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when investment belongs to another user', async () => {
      prisma.investment.findUnique.mockResolvedValue({ ...baseInvestment, userId: 'other-user' });

      await expect(service.findById(userId, investmentId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateInvestment', () => {
    it('should update investment when owned', async () => {
      const dto: UpdateInvestmentDto = { broker: 'Nu Invest' };
      prisma.investment.findUnique.mockResolvedValue(baseInvestment);
      prisma.investment.update.mockResolvedValue({ ...baseInvestment, ...dto });

      const result = await service.updateInvestment(userId, investmentId, dto);

      expect(prisma.investment.update).toHaveBeenCalledWith({
        data: dto,
        where: { id: investmentId },
      });
      expect(result.broker).toBe('Nu Invest');
    });

    it('should throw BadRequestException when investedAmount does not match quantity * buyPrice', async () => {
      const dto: UpdateInvestmentDto = {
        quantity: 200,
        buyPrice: 50.5,
        investedAmount: 5000,
      };
      prisma.investment.findUnique.mockResolvedValue(baseInvestment);

      await expect(service.updateInvestment(userId, investmentId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when investment does not exist', async () => {
      prisma.investment.findUnique.mockResolvedValue(null);

      await expect(service.updateInvestment(userId, investmentId, {})).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when updating another user investment', async () => {
      prisma.investment.findUnique.mockResolvedValue({ ...baseInvestment, userId: 'other-user' });

      await expect(service.updateInvestment(userId, investmentId, {})).rejects.toThrow(ForbiddenException);
    });

    it('should validate marketAssetId when provided in update', async () => {
      const dto: UpdateInvestmentDto = { marketAssetId: 'asset-1' };
      prisma.investment.findUnique.mockResolvedValue(baseInvestment);
      prisma.marketAsset.findUnique.mockResolvedValue({ id: 'asset-1' } as any);
      prisma.investment.update.mockResolvedValue({ ...baseInvestment, marketAssetId: 'asset-1' });

      const result = await service.updateInvestment(userId, investmentId, dto);

      expect(prisma.marketAsset.findUnique).toHaveBeenCalledWith({ where: { id: 'asset-1' } });
      expect(result.marketAssetId).toBe('asset-1');
    });
  });

  describe('deleteInvestment', () => {
    it('should delete investment when owned', async () => {
      prisma.investment.findUnique.mockResolvedValue(baseInvestment);
      prisma.investment.delete.mockResolvedValue(baseInvestment);

      await service.deleteInvestment(userId, investmentId);

      expect(prisma.investment.delete).toHaveBeenCalledWith({ where: { id: investmentId } });
    });

    it('should throw NotFoundException when investment does not exist', async () => {
      prisma.investment.findUnique.mockResolvedValue(null);

      await expect(service.deleteInvestment(userId, investmentId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when deleting another user investment', async () => {
      prisma.investment.findUnique.mockResolvedValue({ ...baseInvestment, userId: 'other-user' });

      await expect(service.deleteInvestment(userId, investmentId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('validateInvestedAmount', () => {
    it('should not throw when investedAmount matches quantity * buyPrice', () => {
      // @ts-expect-error accessing private method for testing
      expect(() => service.validateInvestedAmount(100, 50.5, 5050)).not.toThrow();
    });

    it('should throw BadRequestException when investedAmount does not match', () => {
      // @ts-expect-error accessing private method for testing
      expect(() => service.validateInvestedAmount(100, 50.5, 5000)).toThrow(BadRequestException);
    });

    it('should handle floating point precision within 0.01 tolerance', () => {
      // @ts-expect-error accessing private method for testing
      expect(() => service.validateInvestedAmount(0.1, 0.2, 0.02)).not.toThrow();
    });
  });
});
