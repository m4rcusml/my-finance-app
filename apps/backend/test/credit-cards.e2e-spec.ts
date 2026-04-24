import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2');

describe('CreditCardsController (e2e)', () => {
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

  const baseCreditCard = {
    id: 'card-1',
    userId: 'user-1',
    name: 'Platinum',
    institution: 'Bank A',
    limitTotal: 5000,
    closingDay: 10,
    isActive: true,
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
        creditCard: {
          create: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          count: jest.fn(),
        },
        transaction: {
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
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

      const response = await request(app.getHttpServer())
        .get('/api/v1/credit-cards')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data[0]).toHaveProperty('usedAmount');
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

    it('should return 403 for credit card owned by another user', async () => {
      prisma.creditCard.findUnique.mockResolvedValue({
        ...baseCreditCard,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .get('/api/v1/credit-cards/card-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
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
        .expect(204);
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
