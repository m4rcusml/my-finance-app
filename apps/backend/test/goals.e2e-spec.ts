import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { createMockPrismaService, type MockedPrismaService } from '../src/prisma/prisma.mock';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2');

describe('GoalsController (e2e)', () => {
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

  const baseGoal = {
    id: 'goal-1',
    userId: 'user-1',
    name: 'Viagem Japão',
    type: 'saving',
    targetAmount: 15000,
    currentAmount: 5000,
    deadline: new Date('2025-12-31'),
    relatedCategoryId: null,
    relatedAccountId: null,
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

  describe('POST /api/v1/goals', () => {
    it('should create a goal when authenticated', async () => {
      prisma.goal.create.mockResolvedValue(baseGoal as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Viagem Japão',
          type: 'saving',
          targetAmount: 15000,
          currentAmount: 5000,
          deadline: '2025-12-31',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Viagem Japão');
      expect(response.body.progress).toBeCloseTo(0.3333, 3);
    });

    it('should create a goal with default currentAmount of 0', async () => {
      prisma.goal.create.mockResolvedValue({
        ...baseGoal,
        currentAmount: 0,
      } as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Emergency Fund',
          type: 'saving',
          targetAmount: 10000,
        })
        .expect(201);

      expect(response.body.currentAmount).toBe(0);
      expect(response.body.progress).toBe(0);
    });

    it('should return 404 when relatedAccount does not belong to user', async () => {
      const accountId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.account.findUnique.mockResolvedValue({ id: accountId, userId: 'other-user' } as any);

      await request(app.getHttpServer())
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Viagem Japão',
          type: 'saving',
          targetAmount: 15000,
          relatedAccountId: accountId,
        })
        .expect(404);
    });

    it('should return 404 when relatedCategory does not belong to user', async () => {
      const categoryId = '550e8400-e29b-41d4-a716-446655440002';
      prisma.category.findUnique.mockResolvedValue({ id: categoryId, userId: 'other-user' } as any);

      await request(app.getHttpServer())
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Viagem Japão',
          type: 'saving',
          targetAmount: 15000,
          relatedCategoryId: categoryId,
        })
        .expect(404);
    });

    it('should return 400 when type is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Viagem Japão',
          type: 'invalid_type',
          targetAmount: 15000,
        })
        .expect(400);
    });

    it('should return 400 when targetAmount is negative', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Viagem Japão',
          type: 'saving',
          targetAmount: -100,
        })
        .expect(400);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/goals')
        .send({
          name: 'Viagem Japão',
          type: 'saving',
          targetAmount: 15000,
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/goals', () => {
    it('should return list of goals with progress for the user', async () => {
      prisma.goal.findMany.mockResolvedValue([baseGoal] as any);
      prisma.goal.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Viagem Japão');
      expect(response.body.data[0].progress).toBeCloseTo(0.3333, 3);
      expect(response.body.meta.totalItems).toBe(1);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/v1/goals').expect(401);
    });
  });

  describe('GET /api/v1/goals/:id', () => {
    it('should return goal by id when owned', async () => {
      prisma.goal.findUnique.mockResolvedValue(baseGoal as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/goals/goal-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe('goal-1');
      expect(response.body.progress).toBeCloseTo(0.3333, 3);
    });

    it('should return 404 for non-existent goal', async () => {
      prisma.goal.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/goals/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for goal owned by another user', async () => {
      prisma.goal.findUnique.mockResolvedValue({
        ...baseGoal,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .get('/api/v1/goals/goal-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/goals/:id', () => {
    it('should update goal when owned', async () => {
      prisma.goal.findUnique.mockResolvedValue(baseGoal as any);
      prisma.goal.update.mockResolvedValue({
        ...baseGoal,
        name: 'Viagem Europa',
      } as any);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/goals/goal-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Viagem Europa' })
        .expect(200);

      expect(response.body.name).toBe('Viagem Europa');
    });

    it('should return 404 for non-existent goal', async () => {
      prisma.goal.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch('/api/v1/goals/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });

    it('should return 404 for goal owned by another user', async () => {
      prisma.goal.findUnique.mockResolvedValue({
        ...baseGoal,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .patch('/api/v1/goals/goal-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/goals/:id', () => {
    it('should delete goal when owned', async () => {
      prisma.goal.findUnique.mockResolvedValue(baseGoal as any);
      prisma.goal.delete.mockResolvedValue(baseGoal as any);

      await request(app.getHttpServer())
        .delete('/api/v1/goals/goal-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });

    it('should return 404 for non-existent goal', async () => {
      prisma.goal.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete('/api/v1/goals/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for goal owned by another user', async () => {
      prisma.goal.findUnique.mockResolvedValue({
        ...baseGoal,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .delete('/api/v1/goals/goal-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/v1/goals/:id/progress', () => {
    it('should return progress for a goal', async () => {
      prisma.goal.findUnique.mockResolvedValue(baseGoal as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/goals/goal-1/progress')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.goalId).toBe('goal-1');
      expect(response.body.targetAmount).toBe(15000);
      expect(response.body.currentAmount).toBe(5000);
      expect(response.body.progress).toBeCloseTo(0.3333, 4);
      expect(response.body.percentage).toBeCloseTo(33.33, 2);
    });

    it('should return 404 for non-existent goal', async () => {
      prisma.goal.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/goals/nonexistent/progress')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for goal owned by another user', async () => {
      prisma.goal.findUnique.mockResolvedValue({
        ...baseGoal,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .get('/api/v1/goals/goal-1/progress')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
