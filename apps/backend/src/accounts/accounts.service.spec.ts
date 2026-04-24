import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto, UpdateAccountDto } from './accounts.dto';

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: jest.Mocked<PrismaService>;

  const userId = 'user-1';
  const accountId = 'account-1';

  const baseAccount = {
    id: accountId,
    userId,
    name: 'Main Account',
    institution: 'Bank A',
    type: 'checking',
    initialBalance: 1000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: PrismaService,
          useValue: {
            account: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAccount', () => {
    it('should create an account for the user', async () => {
      const dto: CreateAccountDto = {
        name: 'Savings',
        institution: 'Bank B',
        type: 'savings',
        initialBalance: 500,
      };
      prisma.account.create.mockResolvedValue({ ...baseAccount, ...dto });

      const result = await service.createAccount(userId, dto);

      expect(prisma.account.create).toHaveBeenCalledWith({
        data: { ...dto, userId },
      });
      expect(result.name).toBe('Savings');
    });
  });

  describe('findAllByUser', () => {
    it('should return accounts with calculated balance including transactions', async () => {
      prisma.account.findMany.mockResolvedValue([
        {
          ...baseAccount,
          transactions: [
            { type: 'income', value: 500 },
            { type: 'expense', value: 200 },
          ],
        },
      ]);

      const result = await service.findAllByUser(userId);

      expect(result).toHaveLength(1);
      expect(result[0].balance).toBe(1300); // 1000 + 500 - 200
      expect(result[0]).not.toHaveProperty('transactions');
    });

    it('should handle accounts with no transactions', async () => {
      prisma.account.findMany.mockResolvedValue([
        {
          ...baseAccount,
          transactions: [],
        },
      ]);

      const result = await service.findAllByUser(userId);

      expect(result[0].balance).toBe(1000);
    });
  });

  describe('findById', () => {
    it('should return account with balance when found and owned', async () => {
      prisma.account.findUnique.mockResolvedValue({
        ...baseAccount,
        transactions: [{ type: 'income', value: 300 }],
      });

      const result = await service.findById(userId, accountId);

      expect(result.balance).toBe(1300);
      expect(result.id).toBe(accountId);
    });

    it('should throw NotFoundException when account does not exist', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.findById(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when account belongs to another user', async () => {
      prisma.account.findUnique.mockResolvedValue({ ...baseAccount, userId: 'other-user' });

      await expect(service.findById(userId, accountId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateAccount', () => {
    it('should update account when owned', async () => {
      const dto: UpdateAccountDto = { name: 'Updated Name' };
      prisma.account.findUnique.mockResolvedValue(baseAccount);
      prisma.account.update.mockResolvedValue({
        ...baseAccount,
        ...dto,
        transactions: [],
      });

      const result = await service.updateAccount(userId, accountId, dto);

      expect(prisma.account.update).toHaveBeenCalledWith({
        data: dto,
        where: { id: accountId },
        include: { transactions: { select: { type: true, value: true } } },
      });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when account does not exist', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.updateAccount(userId, accountId, {})).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when updating another user account', async () => {
      prisma.account.findUnique.mockResolvedValue({ ...baseAccount, userId: 'other-user' });

      await expect(service.updateAccount(userId, accountId, {})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteAccount', () => {
    it('should delete account when owned', async () => {
      prisma.account.findUnique.mockResolvedValue(baseAccount);
      prisma.account.delete.mockResolvedValue(baseAccount);

      await service.deleteAccount(userId, accountId);

      expect(prisma.account.delete).toHaveBeenCalledWith({ where: { id: accountId } });
    });

    it('should throw NotFoundException when account does not exist', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.deleteAccount(userId, accountId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when deleting another user account', async () => {
      prisma.account.findUnique.mockResolvedValue({ ...baseAccount, userId: 'other-user' });

      await expect(service.deleteAccount(userId, accountId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('calculateAccountBalance', () => {
    it('should correctly calculate balance with mixed transactions', () => {
      const account = {
        initialBalance: 1000,
        transactions: [
          { type: 'income', value: 500 },
          { type: 'expense', value: 200 },
          { type: 'INCOME', value: 100 },
          { type: 'EXPENSE', value: 50 },
        ],
      };

      // @ts-expect-error accessing private method for testing
      const balance = service.calculateAccountBalance(account);
      expect(balance).toBe(1350); // 1000 + 500 - 200 + 100 - 50
    });

    it('should return initial balance when no transactions', () => {
      const account = {
        initialBalance: 500,
        transactions: [],
      };

      // @ts-expect-error accessing private method for testing
      const balance = service.calculateAccountBalance(account);
      expect(balance).toBe(500);
    });

    it('should handle Decimal-like values by converting to Number', () => {
      const account = {
        initialBalance: { toNumber: () => 1000, valueOf: () => 1000 },
        transactions: [
          { type: 'income', value: { toNumber: () => 250, valueOf: () => 250 } },
          { type: 'expense', value: { toNumber: () => 75, valueOf: () => 75 } },
        ],
      };

      // @ts-expect-error accessing private method for testing
      const balance = service.calculateAccountBalance(account);
      expect(balance).toBe(1175);
    });
  });
});
