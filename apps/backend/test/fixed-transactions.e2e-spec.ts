import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { createMockPrismaService, type MockedPrismaService } from '../src/prisma/prisma.mock';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2');

describe('FixedTransactionsController (e2e)', () => {
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

  const baseFixedTransaction = {
    id: '550e8400-e29b-41d4-a716-446655440003',
    userId: 'user-1',
    type: 'expense',
    value: 100,
    referenceDay: 15,
    marginDays: 3,
    accountId: '550e8400-e29b-41d4-a716-446655440001',
    creditCardId: null,
    categoryId: '550e8400-e29b-41d4-a716-446655440002',
    description: 'Rent',
    isActive: true,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const baseOccurrence = {
    id: '550e8400-e29b-41d4-a716-446655440004',
    fixedTransactionId: '550e8400-e29b-41d4-a716-446655440003',
    userId: 'user-1',
    periodYear: 2026,
    periodMonth: 4,
    status: 'pending',
    realDate: null,
    dueDate: new Date('2026-04-15T00:00:00.000Z'),
    transactionId: null,
    type: 'expense',
    value: 100,
    description: 'Rent',
    categoryId: '550e8400-e29b-41d4-a716-446655440002',
    accountId: '550e8400-e29b-41d4-a716-446655440001',
    creditCardId: null,
    fixedTransaction: {
      id: '550e8400-e29b-41d4-a716-446655440003',
      description: 'Rent',
      referenceDay: 15,
      marginDays: 3,
    },
    category: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Moradia',
      type: 'expense',
    },
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

  describe('POST /api/v1/fixed-transactions', () => {
    it('should create a fixed transaction', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        userId: 'user-1',
        isActive: true,
      } as any);
      prisma.category.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440002',
        userId: 'user-1',
        isActive: true,
        type: 'expense',
      } as any);
      prisma.fixedTransaction.create.mockResolvedValue(baseFixedTransaction as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/fixed-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          value: 100,
          referenceDay: 15,
          marginDays: 3,
          accountId: '550e8400-e29b-41d4-a716-446655440001',
          categoryId: '550e8400-e29b-41d4-a716-446655440002',
          description: 'Rent',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.referenceDay).toBe(15);
    });
  });

  describe('GET /api/v1/fixed-transactions', () => {
    it('should return list of fixed transactions', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([baseFixedTransaction] as any);
      prisma.fixedTransaction.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/fixed-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta.totalItems).toBe(1);
    });
  });

  describe('GET /api/v1/fixed-transactions/:id', () => {
    it('should return fixed transaction by id when owned', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue(baseFixedTransaction as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/fixed-transactions/550e8400-e29b-41d4-a716-446655440003')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe('550e8400-e29b-41d4-a716-446655440003');
    });
  });

  describe('PATCH /api/v1/fixed-transactions/:id', () => {
    it('should update fixed transaction when owned', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue(baseFixedTransaction as any);
      prisma.fixedTransaction.update.mockResolvedValue({
        ...baseFixedTransaction,
        description: 'Updated Rent',
      } as any);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/fixed-transactions/550e8400-e29b-41d4-a716-446655440003')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Updated Rent' })
        .expect(200);

      expect(response.body.description).toBe('Updated Rent');
    });
  });

  describe('DELETE /api/v1/fixed-transactions/:id', () => {
    it('should archive fixed transaction when DELETE is called', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue(baseFixedTransaction as any);
      prisma.fixedTransaction.update.mockResolvedValue({
        ...baseFixedTransaction,
        isActive: false,
        archivedAt: new Date(),
      } as any);

      await request(app.getHttpServer())
        .delete('/api/v1/fixed-transactions/550e8400-e29b-41d4-a716-446655440003')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      expect(prisma.fixedTransaction.delete).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent fixed transaction', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete('/api/v1/fixed-transactions/550e8400-e29b-41d4-a716-446655440099')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for fixed transaction owned by another user', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue({
        ...baseFixedTransaction,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .delete('/api/v1/fixed-transactions/550e8400-e29b-41d4-a716-446655440003')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /api/v1/fixed-transactions/:id/archive', () => {
    it('should archive fixed transaction when owned', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue(baseFixedTransaction as any);
      prisma.fixedTransaction.update.mockResolvedValue({
        ...baseFixedTransaction,
        isActive: false,
        archivedAt: new Date(),
      } as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/fixed-transactions/550e8400-e29b-41d4-a716-446655440003/archive')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.isActive).toBe(false);
    });
  });

  describe('GET /api/v1/fixed-transactions/occurrences', () => {
    it('should return occurrences by year and month', async () => {
      prisma.fixedTransactionOccurrence.findMany.mockResolvedValue([baseOccurrence] as any);
      prisma.fixedTransactionOccurrence.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/fixed-transactions/occurrences?year=2026&month=4')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data[0].periodYear).toBe(2026);
      expect(response.body.data[0].periodMonth).toBe(4);
      expect(response.body.meta.totalItems).toBe(1);
    });

    it('should filter occurrences by status', async () => {
      prisma.fixedTransactionOccurrence.findMany.mockResolvedValue([{ ...baseOccurrence, status: 'confirmed' }] as any);
      prisma.fixedTransactionOccurrence.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/fixed-transactions/occurrences?year=2026&month=4&status=confirmed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data[0].status).toBe('confirmed');
      expect(response.body.meta.totalItems).toBe(1);
    });
  });

  describe('POST /api/v1/fixed-transactions/occurrences/:id/confirm', () => {
    it('should confirm an occurrence and create a transaction', async () => {
      const confirmedOccurrence = {
        ...baseOccurrence,
        status: 'confirmed',
        realDate: new Date('2026-04-15T00:00:00.000Z'),
        transactionId: '550e8400-e29b-41d4-a716-446655440005',
      };
      prisma.fixedTransactionOccurrence.findFirst
        .mockResolvedValueOnce(baseOccurrence as any)
        .mockResolvedValueOnce(confirmedOccurrence as any);
      prisma.account.findUnique.mockResolvedValue({
        id: baseOccurrence.accountId,
        userId: baseOccurrence.userId,
        isActive: true,
      } as any);
      prisma.category.findUnique.mockResolvedValue({
        id: baseOccurrence.categoryId,
        userId: baseOccurrence.userId,
        isActive: true,
        type: 'expense',
      } as any);
      prisma.transaction.create.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440005' } as any);
      prisma.fixedTransactionOccurrence.updateMany.mockResolvedValue({ count: 1 });

      const response = await request(app.getHttpServer())
        .post('/api/v1/fixed-transactions/occurrences/550e8400-e29b-41d4-a716-446655440004/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ realDate: '2026-04-15' })
        .expect(200);

      expect(response.body.status).toBe('confirmed');
      expect(response.body.transactionId).toBe('550e8400-e29b-41d4-a716-446655440005');
    });
  });

  describe('POST /api/v1/fixed-transactions/occurrences/:id/skip', () => {
    it('should skip an occurrence', async () => {
      prisma.fixedTransactionOccurrence.findFirst.mockResolvedValueOnce(baseOccurrence as any).mockResolvedValueOnce({
        ...baseOccurrence,
        status: 'skipped',
      } as any);
      prisma.fixedTransactionOccurrence.updateMany.mockResolvedValue({ count: 1 });

      const response = await request(app.getHttpServer())
        .post('/api/v1/fixed-transactions/occurrences/550e8400-e29b-41d4-a716-446655440004/skip')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('skipped');
    });
  });
});
