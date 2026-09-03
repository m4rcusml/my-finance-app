import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { createMockPrismaService, type MockedPrismaService } from '../src/prisma/prisma.mock';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2');

describe('DashboardController (e2e)', () => {
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

  describe('GET /api/v1/dashboard', () => {
    it('should return dashboard overview at root path (not /overview)', async () => {
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
