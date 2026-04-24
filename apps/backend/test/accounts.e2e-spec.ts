import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as argon2 from 'argon2';

jest.mock('argon2');

describe('AccountsController (e2e)', () => {
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

  const baseAccount = {
    id: 'account-1',
    userId: 'user-1',
    name: 'Main Account',
    institution: 'Bank A',
    type: 'checking',
    initialBalance: 1000,
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
        account: {
          create: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
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

    // Setup auth
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

  describe('POST /api/v1/accounts', () => {
    it('should create an account when authenticated', async () => {
      prisma.account.create.mockResolvedValue(baseAccount as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Main Account',
          institution: 'Bank A',
          type: 'checking',
          initialBalance: 1000,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Main Account');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .send({ name: 'Test', institution: 'Bank', type: 'checking', initialBalance: 0 })
        .expect(401);
    });
  });

  describe('GET /api/v1/accounts', () => {
    it('should return list of accounts with balances', async () => {
      prisma.account.findMany.mockResolvedValue([
        {
          ...baseAccount,
          transactions: [
            { type: 'income', value: 500 },
            { type: 'expense', value: 200 },
          ],
        },
      ] as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('balance', 1300);
    });
  });

  describe('GET /api/v1/accounts/:id', () => {
    it('should return account by id when owned', async () => {
      prisma.account.findUnique.mockResolvedValue({
        ...baseAccount,
        transactions: [],
      } as any);

      const response = await request(app.getHttpServer())
        .get('/api/v1/accounts/account-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe('account-1');
    });

    it('should return 404 for non-existent account', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/accounts/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 403 for account owned by another user', async () => {
      prisma.account.findUnique.mockResolvedValue({
        ...baseAccount,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .get('/api/v1/accounts/account-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('PATCH /api/v1/accounts/:id', () => {
    it('should update account when owned', async () => {
      prisma.account.findUnique.mockResolvedValue(baseAccount as any);
      prisma.account.update.mockResolvedValue({
        ...baseAccount,
        name: 'Updated Account',
        transactions: [],
      } as any);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/accounts/account-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Account' })
        .expect(200);

      expect(response.body.name).toBe('Updated Account');
    });
  });

  describe('DELETE /api/v1/accounts/:id', () => {
    it('should delete account when owned', async () => {
      prisma.account.findUnique.mockResolvedValue(baseAccount as any);
      prisma.account.delete.mockResolvedValue(baseAccount as any);

      await request(app.getHttpServer())
        .delete('/api/v1/accounts/account-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });

    it('should return 404 for non-existent account', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete('/api/v1/accounts/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
