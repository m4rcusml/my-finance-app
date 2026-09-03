import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { createMockPrismaService, type MockedPrismaService } from '../src/prisma/prisma.mock';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2');

describe('CreditCardsController (e2e)', () => {
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

  const baseCreditCard = {
    id: 'card-1',
    userId: 'user-1',
    name: 'Platinum',
    institution: 'Bank A',
    limitTotal: 5000,
    closingDay: 10,
    isActive: true,
    archivedAt: null,
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

  describe('POST /api/v1/credit-cards', () => {
    it('should create a credit card when authenticated', async () => {
      prisma.creditCard.create.mockResolvedValue(baseCreditCard as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/credit-cards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Platinum',
          institution: 'Bank A',
          limitTotal: 5000,
          closingDay: 10,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Platinum');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/credit-cards')
        .send({ name: 'Test', institution: 'Bank', limitTotal: 1000 })
        .expect(401);
    });
  });

  describe('GET /api/v1/credit-cards', () => {
    it('should return list of credit cards with usage', async () => {
      prisma.creditCard.findMany.mockResolvedValue([{ ...baseCreditCard, transactions: [{ value: 500 }] }] as any);
      prisma.creditCard.count.mockResolvedValue(1);
      prisma.transaction.groupBy.mockResolvedValue([{ creditCardId: 'card-1', _sum: { value: 500 } }] as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/credit-cards')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data[0]).toHaveProperty('cycleUsedAmount', 500);
      expect(response.body.data[0]).toHaveProperty('availableAmount');
      expect(response.body.meta.totalItems).toBe(1);
    });
  });

  describe('GET /api/v1/credit-cards/:id', () => {
    it('should return credit card by id when owned', async () => {
      prisma.creditCard.findUnique.mockResolvedValue({
        ...baseCreditCard,
        transactions: [],
      } as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/credit-cards/card-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe('card-1');
    });

    it('should return 404 for non-existent credit card', async () => {
      prisma.creditCard.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/credit-cards/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should hide a credit card owned by another user with 404', async () => {
      prisma.creditCard.findUnique.mockResolvedValue({
        ...baseCreditCard,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .get('/api/v1/credit-cards/card-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/credit-cards/:id', () => {
    it('should update credit card when owned', async () => {
      prisma.creditCard.findUnique.mockResolvedValue(baseCreditCard as any);
      prisma.creditCard.update.mockResolvedValue({
        ...baseCreditCard,
        name: 'Updated Card',
      } as any);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/credit-cards/card-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Card' })
        .expect(200);

      expect(response.body.name).toBe('Updated Card');
    });
  });

  describe('DELETE /api/v1/credit-cards/:id', () => {
    it('should delete credit card when owned', async () => {
      prisma.creditCard.findUnique.mockResolvedValue(baseCreditCard as any);
      prisma.creditCard.delete.mockResolvedValue(baseCreditCard as any);

      await request(app.getHttpServer())
        .delete('/api/v1/credit-cards/card-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should return 404 for non-existent credit card', async () => {
      prisma.creditCard.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete('/api/v1/credit-cards/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
