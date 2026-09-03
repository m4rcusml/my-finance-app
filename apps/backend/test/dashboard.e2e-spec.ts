import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2');

describe('DashboardController (e2e)', () => {
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
          count: jest.fn(),
        },
        creditCard: {
          findMany: jest.fn(),
          count: jest.fn(),
        },
        transaction: {
          findMany: jest.fn(),
          count: jest.fn(),
        },
        fixedTransaction: {
          findMany: jest.fn(),
        },
        fixedTransactionOccurrence: {
          findMany: jest.fn(),
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

  describe('GET /api/v1/dashboard', () => {
    it('should return dashboard overview at root path (not /overview)', async () => {
      prisma.account.findMany.mockResolvedValue([
        {
          id: 'account-1',
          userId: 'user-1',
          name: 'Main',
          institution: 'Bank',
          type: 'checking',
          initialBalance: 1000,
          isActive: true,
          transactions: [{ type: 'income', value: 500 }],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);
      prisma.creditCard.findMany.mockResolvedValue([
        {
          id: 'card-1',
          userId: 'user-1',
          name: 'Platinum',
          institution: 'Bank',
          limitTotal: 5000,
          isActive: true,
          transactions: [{ type: 'expense', value: 200 }],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);
      prisma.transaction.findMany.mockResolvedValue([
        { type: 'income', value: 500, date: new Date() },
        { type: 'expense', value: 200, date: new Date() },
      ] as any);
      prisma.fixedTransaction.findMany.mockResolvedValue([] as any);
      prisma.fixedTransactionOccurrence.findMany.mockResolvedValue([] as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totals');
      expect(response.body).toHaveProperty('accounts');
      expect(response.body).toHaveProperty('creditCards');
      expect(response.body).toHaveProperty('latestTransactions');
      expect(response.body).toHaveProperty('annualBalance');
    });

    it('should return 404 for /dashboard/overview (subpath does not exist)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/dashboard/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should accept referenceDate query parameter', async () => {
      prisma.account.findMany.mockResolvedValue([] as any);
      prisma.creditCard.findMany.mockResolvedValue([] as any);
      prisma.transaction.findMany.mockResolvedValue([] as any);
      prisma.fixedTransaction.findMany.mockResolvedValue([] as any);
      prisma.fixedTransactionOccurrence.findMany.mockResolvedValue([] as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/dashboard?referenceDate=2026-04-01')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('period');
      expect(response.body.period).toHaveProperty('referenceDate');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/v1/dashboard').expect(401);
    });
  });
});
