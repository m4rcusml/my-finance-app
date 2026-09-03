import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { createMockPrismaService, type MockedPrismaService } from '../src/prisma/prisma.mock';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2');

describe('CategoriesController (e2e)', () => {
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

  const baseCategory = {
    id: 'category-1',
    userId: 'user-1',
    name: 'Food',
    type: 'expense',
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

  describe('POST /api/v1/categories', () => {
    it('should create a category with lowercase type', async () => {
      prisma.category.create.mockResolvedValue(baseCategory as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Food', type: 'expense' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe('expense');
    });

    it('should reject uppercase type (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Food', type: 'EXPENSE' })
        .expect(400);
    });

    it('should accept "both" type', async () => {
      prisma.category.create.mockResolvedValue({ ...baseCategory, type: 'both' } as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'General', type: 'both' })
        .expect(201);

      expect(response.body.type).toBe('both');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).post('/api/v1/categories').send({ name: 'Food', type: 'expense' }).expect(401);
    });
  });

  describe('GET /api/v1/categories', () => {
    it('should return list of categories', async () => {
      prisma.category.findMany.mockResolvedValue([baseCategory] as any);
      prisma.category.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data[0].name).toBe('Food');
      expect(response.body.meta.totalItems).toBe(1);
    });
  });

  describe('GET /api/v1/categories/:id', () => {
    it('should return category by id when owned', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/categories/category-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe('category-1');
    });

    it('should return 404 for non-existent category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/categories/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should hide a category owned by another user with 404', async () => {
      prisma.category.findUnique.mockResolvedValue({
        ...baseCategory,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .get('/api/v1/categories/category-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/categories/:id', () => {
    it('should update category when owned', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory as any);
      prisma.category.update.mockResolvedValue({
        ...baseCategory,
        name: 'Updated Food',
      } as any);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/categories/category-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Food' })
        .expect(200);

      expect(response.body.name).toBe('Updated Food');
    });
  });

  describe('DELETE /api/v1/categories/:id', () => {
    it('should delete category when owned and no dependencies', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory as any);
      prisma.transaction.count.mockResolvedValue(0);
      prisma.fixedTransaction.count.mockResolvedValue(0);
      prisma.category.delete.mockResolvedValue(baseCategory as any);

      await request(app.getHttpServer())
        .delete('/api/v1/categories/category-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should archive when category has linked transactions', async () => {
      prisma.category.findUnique.mockResolvedValue(baseCategory as any);
      prisma.transaction.count.mockResolvedValue(1);
      prisma.category.update.mockResolvedValue({
        ...baseCategory,
        isActive: false,
        archivedAt: new Date(),
      } as any);

      const response = await request(app.getHttpServer())
        .delete('/api/v1/categories/category-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isActive).toBe(false);
    });

    it('should return 404 for non-existent category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete('/api/v1/categories/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
