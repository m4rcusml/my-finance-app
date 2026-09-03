import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { createMockPrismaService, type MockedPrismaService } from '../src/prisma/prisma.mock';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2');

describe('InvestmentsController (e2e)', () => {
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

  const baseInvestment = {
    id: 'investment-1',
    userId: 'user-1',
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

    // Setup auth
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

  describe('POST /api/v1/investments', () => {
    it('should create an investment when authenticated', async () => {
      prisma.investment.create.mockResolvedValue(baseInvestment as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          broker: 'XP Investimentos',
          type: 'stock',
          quantity: 100,
          buyPrice: 50.5,
          investedAmount: 5050,
          buyDate: '2024-01-15',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.broker).toBe('XP Investimentos');
      expect(response.body.type).toBe('stock');
    });

    it('should create an investment with marketAssetId when asset exists', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        userId: 'user-1',
        symbol: 'PETR4',
        type: 'stock',
        exchange: 'B3',
      } as any);
      prisma.investment.create.mockResolvedValue({
        ...baseInvestment,
        marketAssetId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      } as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          broker: 'XP Investimentos',
          type: 'stock',
          quantity: 100,
          buyPrice: 50.5,
          investedAmount: 5050,
          buyDate: '2024-01-15',
          marketAssetId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        })
        .expect(201);

      expect(response.body.marketAssetId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    });

    it('should return 400 when investedAmount does not match quantity * buyPrice', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          broker: 'XP Investimentos',
          type: 'stock',
          quantity: 100,
          buyPrice: 50.5,
          investedAmount: 5000,
          buyDate: '2024-01-15',
        })
        .expect(400);
    });

    it('should return 400 when marketAssetId does not exist', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          broker: 'XP Investimentos',
          type: 'stock',
          quantity: 100,
          buyPrice: 50.5,
          investedAmount: 5050,
          buyDate: '2024-01-15',
          marketAssetId: '11111111-2222-3333-4444-555555555555',
        })
        .expect(400);
    });

    it('should return 400 when type is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          broker: 'XP Investimentos',
          type: 'invalid_type',
          quantity: 100,
          buyPrice: 50.5,
          investedAmount: 5050,
          buyDate: '2024-01-15',
        })
        .expect(400);
    });

    it('should return 400 when quantity is negative', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          broker: 'XP Investimentos',
          type: 'stock',
          quantity: -10,
          buyPrice: 50.5,
          investedAmount: -505,
          buyDate: '2024-01-15',
        })
        .expect(400);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/investments')
        .send({
          broker: 'XP Investimentos',
          type: 'stock',
          quantity: 100,
          buyPrice: 50.5,
          investedAmount: 5050,
          buyDate: '2024-01-15',
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/investments', () => {
    it('should return list of investments for the user', async () => {
      prisma.investment.findMany.mockResolvedValue([baseInvestment] as any);
      prisma.investment.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/investments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].broker).toBe('XP Investimentos');
      expect(response.body.meta.totalItems).toBe(1);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/v1/investments').expect(401);
    });
  });

  describe('GET /api/v1/investments/:id', () => {
    it('should return investment by id when owned', async () => {
      prisma.investment.findUnique.mockResolvedValue(baseInvestment as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/investments/investment-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe('investment-1');
      expect(response.body.broker).toBe('XP Investimentos');
    });

    it('should return 404 for non-existent investment', async () => {
      prisma.investment.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/investments/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should hide an investment owned by another user with 404', async () => {
      prisma.investment.findUnique.mockResolvedValue({
        ...baseInvestment,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .get('/api/v1/investments/investment-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/investments/:id', () => {
    it('should update investment when owned', async () => {
      prisma.investment.findUnique.mockResolvedValue(baseInvestment as any);
      prisma.investment.update.mockResolvedValue({
        ...baseInvestment,
        broker: 'Nu Invest',
      } as any);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/investments/investment-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ broker: 'Nu Invest' })
        .expect(200);

      expect(response.body.broker).toBe('Nu Invest');
    });

    it('should return 400 when updating investedAmount without matching quantity * buyPrice', async () => {
      prisma.investment.findUnique.mockResolvedValue(baseInvestment as any);

      await request(app.getHttpServer())
        .patch('/api/v1/investments/investment-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 200,
          buyPrice: 50.5,
          investedAmount: 5000,
        })
        .expect(400);
    });

    it('should return 404 for non-existent investment', async () => {
      prisma.investment.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch('/api/v1/investments/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ broker: 'Nu Invest' })
        .expect(404);
    });

    it('should hide another user investment on update with 404', async () => {
      prisma.investment.findUnique.mockResolvedValue({
        ...baseInvestment,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .patch('/api/v1/investments/investment-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ broker: 'Nu Invest' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/investments/:id', () => {
    it('should delete investment when owned', async () => {
      prisma.investment.findUnique.mockResolvedValue(baseInvestment as any);
      prisma.investment.delete.mockResolvedValue(baseInvestment as any);

      await request(app.getHttpServer())
        .delete('/api/v1/investments/investment-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });

    it('should return 404 for non-existent investment', async () => {
      prisma.investment.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete('/api/v1/investments/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should hide another user investment on delete with 404', async () => {
      prisma.investment.findUnique.mockResolvedValue({
        ...baseInvestment,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .delete('/api/v1/investments/investment-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
