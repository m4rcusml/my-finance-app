import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { createMockPrismaService, type MockedPrismaService } from '../src/prisma/prisma.mock';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2');

describe('MarketAssetsController (e2e)', () => {
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

  const baseMarketAsset = {
    id: 'asset-1',
    userId: 'user-1',
    symbol: 'PETR4',
    type: 'stock',
    exchange: 'B3',
    name: 'Petrobras PN',
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

  describe('POST /api/v1/market-assets', () => {
    it('should create a market asset when authenticated', async () => {
      prisma.marketAsset.create.mockResolvedValue(baseMarketAsset as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/market-assets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'PETR4',
          type: 'stock',
          exchange: 'B3',
          name: 'Petrobras PN',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.symbol).toBe('PETR4');
    });

    it('should return 409 when symbol+exchange already exists', async () => {
      prisma.marketAsset.create.mockRejectedValue({ code: 'P2002' });

      await request(app.getHttpServer())
        .post('/api/v1/market-assets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'PETR4',
          type: 'stock',
          exchange: 'B3',
        })
        .expect(409);
    });

    it('should return 400 when type is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/market-assets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'PETR4',
          type: 'invalid',
          exchange: 'B3',
        })
        .expect(400);
    });

    it('should return 400 when symbol is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/market-assets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'stock',
          exchange: 'B3',
        })
        .expect(400);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/market-assets')
        .send({
          symbol: 'PETR4',
          type: 'stock',
          exchange: 'B3',
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/market-assets', () => {
    it('should return only the user assets', async () => {
      prisma.marketAsset.findMany.mockResolvedValue([baseMarketAsset] as any);
      prisma.marketAsset.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/market-assets')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.totalItems).toBe(1);
      expect(prisma.marketAsset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/v1/market-assets').expect(401);
    });
  });

  describe('GET /api/v1/market-assets/:id', () => {
    it('should return asset by id when owned', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(baseMarketAsset as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/market-assets/asset-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe('asset-1');
      expect(response.body.symbol).toBe('PETR4');
    });

    it('should hide a legacy global asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({
        ...baseMarketAsset,
        userId: null,
      } as any);

      await request(app.getHttpServer())
        .get('/api/v1/market-assets/asset-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/market-assets/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for asset owned by another user', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({
        ...baseMarketAsset,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .get('/api/v1/market-assets/asset-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/market-assets/:id', () => {
    it('should update asset when owned', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(baseMarketAsset as any);
      prisma.marketAsset.update.mockResolvedValue({
        ...baseMarketAsset,
        name: 'Petrobras Updated',
      } as any);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/market-assets/asset-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Petrobras Updated' })
        .expect(200);

      expect(response.body.name).toBe('Petrobras Updated');
    });

    it('should return 404 when updating a legacy global asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({
        ...baseMarketAsset,
        userId: null,
      } as any);

      await request(app.getHttpServer())
        .patch('/api/v1/market-assets/asset-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });

    it('should return 404 when updating another user asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({
        ...baseMarketAsset,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .patch('/api/v1/market-assets/asset-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });

    it('should return 404 for non-existent asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch('/api/v1/market-assets/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/market-assets/:id', () => {
    it('should delete asset when owned', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(baseMarketAsset as any);
      prisma.investment.count.mockResolvedValue(0);
      prisma.marketAsset.delete.mockResolvedValue(baseMarketAsset as any);

      await request(app.getHttpServer())
        .delete('/api/v1/market-assets/asset-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });

    it('should return 404 when deleting a legacy global asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({
        ...baseMarketAsset,
        userId: null,
      } as any);

      await request(app.getHttpServer())
        .delete('/api/v1/market-assets/asset-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 when deleting another user asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue({
        ...baseMarketAsset,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .delete('/api/v1/market-assets/asset-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent asset', async () => {
      prisma.marketAsset.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete('/api/v1/market-assets/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
