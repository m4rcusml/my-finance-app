import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { createMockPrismaService, type MockedPrismaService } from '../src/prisma/prisma.mock';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2');

describe('TransactionsController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: MockedPrismaService;
  let authToken: string;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    name: null,
    tokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const baseTransaction = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    userId: 'user-1',
    type: 'expense',
    value: 100,
    date: new Date('2026-04-01'),
    accountId: '550e8400-e29b-41d4-a716-446655440001',
    creditCardId: null,
    categoryId: null,
    description: 'Test transaction',
    source: 'manual',
    externalId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma.user.findUnique.mockResolvedValue(mockUser as any);
    (argon2.verify as jest.Mock).mockResolvedValue(true);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    authToken = loginResponse.body.accessToken;
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('POST /api/v1/transactions', () => {
    it('should create a transaction linked to an account', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        userId: 'user-1',
        isActive: true,
        transactions: [],
      } as any);
      prisma.transaction.create.mockResolvedValue(baseTransaction as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          value: 100,
          date: '2026-04-01',
          accountId: '550e8400-e29b-41d4-a716-446655440001',
          description: 'Test',
        })
        .expect(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.accountId).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(response.body).not.toHaveProperty('account');
      expect(response.body).not.toHaveProperty('creditCard');
      expect(response.body).not.toHaveProperty('category');
    });

    it('should create a transaction linked to a credit card', async () => {
      prisma.creditCard.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440002',
        userId: 'user-1',
        isActive: true,
        transactions: [],
      } as any);
      prisma.transaction.create.mockResolvedValue({
        ...baseTransaction,
        accountId: null,
        creditCardId: '550e8400-e29b-41d4-a716-446655440002',
      } as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          value: 100,
          date: '2026-04-01',
          creditCardId: '550e8400-e29b-41d4-a716-446655440002',
          description: 'Test',
        })
        .expect(201);

      expect(response.body.creditCardId).toBe('550e8400-e29b-41d4-a716-446655440002');
      expect(response.body.accountId).toBeNull();
    });

    it('should reject when both accountId and creditCardId are provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          value: 100,
          date: '2026-04-01',
          accountId: '550e8400-e29b-41d4-a716-446655440001',
          creditCardId: '550e8400-e29b-41d4-a716-446655440002',
        })
        .expect(400);
    });

    it('should reject when neither accountId nor creditCardId is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          value: 100,
          date: '2026-04-01',
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/transactions', () => {
    it('should filter by type', async () => {
      prisma.transaction.findMany.mockResolvedValue([baseTransaction] as any);
      prisma.transaction.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/transactions?type=expense')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta.totalItems).toBe(1);
    });

    it('should filter by date range', async () => {
      prisma.transaction.findMany.mockResolvedValue([baseTransaction] as any);
      prisma.transaction.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/transactions?fromDate=2026-04-01&toDate=2026-04-30')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta.totalItems).toBe(1);
    });

    it('should filter by categoryId', async () => {
      prisma.transaction.findMany.mockResolvedValue([baseTransaction] as any);
      prisma.transaction.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/transactions?categoryId=550e8400-e29b-41d4-a716-446655440003')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta.totalItems).toBe(1);
    });

    it('should filter by accountId', async () => {
      prisma.transaction.findMany.mockResolvedValue([baseTransaction] as any);
      prisma.transaction.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/transactions?accountId=550e8400-e29b-41d4-a716-446655440001')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta.totalItems).toBe(1);
    });

    it('should filter by creditCardId', async () => {
      prisma.transaction.findMany.mockResolvedValue([
        { ...baseTransaction, creditCardId: '550e8400-e29b-41d4-a716-446655440002' },
      ] as any);
      prisma.transaction.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/transactions?creditCardId=550e8400-e29b-41d4-a716-446655440002')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta.totalItems).toBe(1);
    });
  });

  describe('GET /api/v1/transactions/uncategorized', () => {
    it('should return transactions without category', async () => {
      prisma.transaction.findMany.mockResolvedValue([{ ...baseTransaction, categoryId: null }] as any);
      prisma.transaction.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/transactions/uncategorized')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta.totalItems).toBe(1);
    });
  });

  describe('GET /api/v1/transactions/:id', () => {
    it('should return transaction by id when owned', async () => {
      prisma.transaction.findUnique.mockResolvedValue(baseTransaction as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/transactions/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(response.body).not.toHaveProperty('account');
    });

    it('should hide a transaction owned by another user with 404', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        ...baseTransaction,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .get('/api/v1/transactions/tx-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/transactions/:id', () => {
    it('should update transaction when owned', async () => {
      prisma.transaction.findUnique.mockResolvedValue(baseTransaction as any);
      prisma.transaction.update.mockResolvedValue({
        ...baseTransaction,
        description: 'Updated',
      } as any);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/transactions/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Updated' })
        .expect(200);

      expect(response.body.description).toBe('Updated');
      expect(response.body).not.toHaveProperty('category');
    });
  });

  describe('DELETE /api/v1/transactions/:id', () => {
    it('should delete transaction when owned', async () => {
      prisma.transaction.findUnique.mockResolvedValue(baseTransaction as any);
      prisma.transaction.delete.mockResolvedValue(baseTransaction as any);

      await request(app.getHttpServer())
        .delete('/api/v1/transactions/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });

  describe('GET /api/v1/transactions/summary', () => {
    it('should return total income, expense and net for the period', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { type: 'income', _sum: { value: 5000 }, _count: { _all: 1 } },
        { type: 'expense', _sum: { value: 3500 }, _count: { _all: 2 } },
      ] as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/transactions/summary?from=2026-04-01&to=2026-04-30')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.income).toBe(5000);
      expect(response.body.expense).toBe(3500);
      expect(response.body.net).toBe(1500);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/v1/transactions/summary?from=2026-04-01&to=2026-04-30').expect(401);
    });
  });

  describe('GET /api/v1/transactions/projection', () => {
    it('should return projected expense based on last 3 months average', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { date: new Date('2026-06-15'), type: 'expense', _sum: { value: 3000 } },
        { date: new Date('2026-07-15'), type: 'expense', _sum: { value: 3000 } },
        { date: new Date('2026-08-15'), type: 'expense', _sum: { value: 3000 } },
      ] as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/transactions/projection')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('projectedMonthlyExpense');
      expect(response.body.projectedMonthlyExpense).toBe(3000);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/v1/transactions/projection').expect(401);
    });
  });
});
