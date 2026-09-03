import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2');

describe('ImportsController (e2e)', () => {
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

  const baseImportedFile = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    userId: 'user-1',
    origin: 'inter',
    fileName: 'extrato.csv',
    fileType: 'csv',
    status: 'completed',
    importedAt: new Date(),
    totalRecords: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const baseTransaction = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    userId: 'user-1',
    type: 'expense',
    value: 150,
    date: new Date('2026-04-01'),
    accountId: '550e8400-e29b-41d4-a716-446655440002',
    creditCardId: null,
    categoryId: null,
    description: 'Supermercado',
    source: 'manual',
    externalId: null,
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
          findUnique: jest.fn(),
          findMany: jest.fn(),
        },
        creditCard: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
        },
        transaction: {
          create: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          count: jest.fn(),
        },
        importedFile: {
          create: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          count: jest.fn(),
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

  describe('POST /api/v1/imports/preview', () => {
    it('should return parsed rows from CSV upload', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.account.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440002',
        userId: 'user-1',
      } as any);

      const csvContent = 'Data;Lançamento;Valor\n01/04/2026;Supermercado;-150,00\n02/04/2026;Salário;5000,00';

      const response = await request(app.getHttpServer())
        .post('/api/v1/imports/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .field('origin', 'inter')
        .field('accountId', '550e8400-e29b-41d4-a716-446655440002')
        .attach('file', Buffer.from(csvContent, 'utf-8'), 'extrato.csv')
        .expect(201);

      expect(response.body.rows).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.rows[0]).toMatchObject({
        date: '2026-04-01',
        description: 'Supermercado',
        value: 150,
        type: 'expense',
        isDuplicate: false,
      });
      expect(response.body.rows[1]).toMatchObject({
        date: '2026-04-02',
        description: 'Salário',
        value: 5000,
        type: 'income',
        isDuplicate: false,
      });
    });

    it('should detect duplicates in preview', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.account.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440002',
        userId: 'user-1',
      } as any);

      const csvContent = 'Data;Lançamento;Valor\n01/04/2026;Supermercado;-150,00\n01/04/2026;Supermercado;-150,00';

      const response = await request(app.getHttpServer())
        .post('/api/v1/imports/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .field('origin', 'inter')
        .field('accountId', '550e8400-e29b-41d4-a716-446655440002')
        .attach('file', Buffer.from(csvContent, 'utf-8'), 'extrato.csv')
        .expect(201);

      expect(response.body.rows[0].isDuplicate).toBe(false);
      expect(response.body.rows[1].isDuplicate).toBe(true);
      expect(response.body.duplicates).toBe(1);
    });

    it('should reject unsupported file types', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/imports/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .field('origin', 'inter')
        .attach('file', Buffer.from('test'), 'file.png')
        .expect(400);
    });

    it('should require authentication', async () => {
      const csvContent = 'Data;Lançamento;Valor\n01/04/2026;Test;-10,00';

      await request(app.getHttpServer())
        .post('/api/v1/imports/preview')
        .field('origin', 'inter')
        .attach('file', Buffer.from(csvContent, 'utf-8'), 'extrato.csv')
        .expect(401);
    });
  });

  describe('POST /api/v1/imports/confirm', () => {
    it('should create imported file and transactions', async () => {
      prisma.importedFile.create.mockResolvedValue(baseImportedFile as any);
      prisma.account.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440002',
        userId: 'user-1',
        transactions: [],
      } as any);
      prisma.transaction.create.mockResolvedValue(baseTransaction as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/imports/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          origin: 'inter',
          fileName: 'extrato.csv',
          fileType: 'csv',
          accountId: '550e8400-e29b-41d4-a716-446655440002',
          items: [
            {
              date: '2026-04-01',
              description: 'Supermercado',
              value: 150,
              type: 'expense',
            },
          ],
        })
        .expect(201);

      expect(response.body.createdCount).toBe(1);
      expect(response.body.importedFile).toHaveProperty('id');
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/imports/confirm')
        .send({
          origin: 'inter',
          fileName: 'extrato.csv',
          fileType: 'csv',
          items: [],
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/imports', () => {
    it('should list user imports', async () => {
      prisma.importedFile.findMany.mockResolvedValue([baseImportedFile] as any);
      prisma.importedFile.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/imports')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.totalItems).toBe(1);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/imports').expect(401);
    });
  });

  describe('GET /api/v1/imports/:id', () => {
    it('should return import by id', async () => {
      prisma.importedFile.findUnique.mockResolvedValue(baseImportedFile as any);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/imports/${baseImportedFile.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(baseImportedFile.id);
    });

    it('should return 404 for non-existent import', async () => {
      prisma.importedFile.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/imports/550e8400-e29b-41d4-a716-446655440999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 403 for import owned by another user', async () => {
      prisma.importedFile.findUnique.mockResolvedValue({
        ...baseImportedFile,
        userId: 'other-user',
      } as any);

      await request(app.getHttpServer())
        .get(`/api/v1/imports/${baseImportedFile.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get(`/api/v1/imports/${baseImportedFile.id}`).expect(401);
    });
  });
});
