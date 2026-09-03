import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { createMockPrismaService, type MockedPrismaService } from '../src/prisma/prisma.mock';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2');

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: MockedPrismaService;

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
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and return 201', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
        name: null,
        tokenVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'new@example.com', password: 'Fresh-passphrase-2026!' })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe('new@example.com');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should return 409 when email already exists', async () => {
      prisma.user.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com', password: 'Fresh-passphrase-2026!' })
        .expect(409);

      expect(response.body.message).toBe('Este e-mail já está em uso.');
    });

    it('should return 400 when email is invalid', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should return 400 when password is too short', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com', password: '123' })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return JWT token for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(typeof response.body.accessToken).toBe('string');
    });

    it('should return the same 401 for a non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'unknown@example.com', password: 'password123' })
        .expect(401);
    });

    it('should return 401 for wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' })
        .expect(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user data when authenticated', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      // First login to get token
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      const token = loginResponse.body.accessToken;

      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(meResponse.body.email).toBe('test@example.com');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
