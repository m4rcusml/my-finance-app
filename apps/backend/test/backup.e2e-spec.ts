import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2');

describe('BackupController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: jest.Mocked<PrismaService>;
  let authToken: string;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    name: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const now = new Date();

  const baseBackupData = {
    version: '1.0',
    exportedAt: now.toISOString(),
    user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
    accounts: [] as any[],
    categories: [] as any[],
    creditCards: [] as any[],
    marketAssets: [] as any[],
    transactions: [] as any[],
    fixedTransactions: [] as any[],
    investments: [] as any[],
    goals: [] as any[],
    importedFiles: [] as any[],
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        user: {
          findUnique: jest.fn(),
          create: jest.fn(),
          findMany: jest.fn(),
        },
        account: {
          findMany: jest.fn(),
          create: jest.fn(),
        },
        category: {
          findMany: jest.fn(),
          create: jest.fn(),
        },
        creditCard: {
          findMany: jest.fn(),
          create: jest.fn(),
        },
        marketAsset: {
          findMany: jest.fn(),
          create: jest.fn(),
        },
        transaction: {
          findMany: jest.fn(),
          create: jest.fn(),
        },
        fixedTransaction: {
          findMany: jest.fn(),
          create: jest.fn(),
        },
        investment: {
          findMany: jest.fn(),
          create: jest.fn(),
        },
        goal: {
          findMany: jest.fn(),
          create: jest.fn(),
        },
        importedFile: {
          findMany: jest.fn(),
          create: jest.fn(),
        },
        $connect: jest.fn(),
      })
      .compile();

    prisma = moduleFixture.get(PrismaService);
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma.user.findUnique.mockResolvedValue(mockUser as any);
    (argon2.verify as jest.Mock).mockResolvedValue(true);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    authToken = loginResponse.body.access_token;
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('GET /api/v1/backup/export', () => {
    it('should export user data', async () => {
      prisma.account.findMany.mockResolvedValue([]);
      prisma.category.findMany.mockResolvedValue([]);
      prisma.creditCard.findMany.mockResolvedValue([]);
      prisma.marketAsset.findMany.mockResolvedValue([]);
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.fixedTransaction.findMany.mockResolvedValue([]);
      prisma.investment.findMany.mockResolvedValue([]);
      prisma.goal.findMany.mockResolvedValue([]);
      prisma.importedFile.findMany.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/backup/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.version).toBe('1.0');
      expect(response.body.user.id).toBe('user-1');
      expect(Array.isArray(response.body.accounts)).toBe(true);
      expect(Array.isArray(response.body.transactions)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/backup/export').expect(401);
    });
  });

  describe('POST /api/v1/backup/import', () => {
    it('should restore backup data', async () => {
      const backupData = {
        ...baseBackupData,
        accounts: [
          { id: 'acc-1', name: 'Account', institution: 'Bank', type: 'checking', initialBalance: 100, isActive: true },
        ],
        categories: [{ id: 'cat-1', name: 'Food', type: 'expense' }],
      };

      prisma.account.create.mockResolvedValue({ id: 'new-acc-1' } as any);
      prisma.category.create.mockResolvedValue({ id: 'new-cat-1' } as any);
      prisma.creditCard.create.mockResolvedValue({ id: 'new-cc-1' } as any);
      prisma.marketAsset.create.mockResolvedValue({ id: 'new-ma-1' } as any);
      prisma.transaction.create.mockResolvedValue({ id: 'new-txn-1' } as any);
      prisma.fixedTransaction.create.mockResolvedValue({ id: 'new-ft-1' } as any);
      prisma.investment.create.mockResolvedValue({ id: 'new-inv-1' } as any);
      prisma.goal.create.mockResolvedValue({ id: 'new-goal-1' } as any);
      prisma.importedFile.create.mockResolvedValue({ id: 'new-imp-1' } as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/backup/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ data: backupData })
        .expect(201);

      expect(response.body.restored.accounts).toBe(1);
      expect(response.body.restored.categories).toBe(1);
    });

    it('should reject invalid backup data', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/backup/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ data: { invalid: true } })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).post('/api/v1/backup/import').send({ data: baseBackupData }).expect(401);
    });
  });
});
