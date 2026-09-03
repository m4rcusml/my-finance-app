import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { createMockPrismaService, type MockedPrismaService } from '../src/prisma/prisma.mock';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2');

const BATCH_ID = '550e8400-e29b-41d4-a716-446655440010';
const IMPORTED_FILE_ID = '550e8400-e29b-41d4-a716-446655440000';
const ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440002';

describe('ImportsController (e2e)', () => {
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

  const baseImportedFile = {
    id: IMPORTED_FILE_ID,
    userId: 'user-1',
    origin: 'inter',
    fileName: 'extrato.csv',
    fileType: 'csv',
    status: 'completed',
    importedAt: new Date(),
    totalRecords: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const storedBatch = () => ({
    id: BATCH_ID,
    userId: 'user-1',
    origin: 'inter',
    fileName: 'extrato.csv',
    fileType: 'csv',
    status: 'pending',
    totalRows: 1,
    expiresAt: new Date(Date.now() + 60_000),
    rows: [
      {
        rowNumber: 1,
        type: 'expense',
        value: 150,
        date: new Date('2026-04-01T00:00:00.000Z'),
        description: 'Supermercado',
        externalId: 'external-1',
        duplicate: false,
        errors: [],
      },
    ],
  });

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

  describe('POST /api/v1/imports/preview', () => {
    beforeEach(() => {
      prisma.importBatch.create.mockResolvedValue({ id: BATCH_ID } as any);
    });

    it('parses and persists a CSV preview', async () => {
      const csv = 'Data;Lançamento;Valor\n01/04/2026;Supermercado;-150,00\n02/04/2026;Salário;5000,00';

      const response = await request(app.getHttpServer())
        .post('/api/v1/imports/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .field('origin', 'inter')
        .attach('file', Buffer.from(csv, 'utf-8'), 'extrato.csv')
        .expect(201);

      expect(response.body).toMatchObject({
        batchId: BATCH_ID,
        totalRows: 2,
        validRows: 2,
        duplicateRows: 0,
        invalidRows: 0,
      });
      expect(response.body.rows[0]).toMatchObject({
        date: '2026-04-01',
        description: 'Supermercado',
        value: 150,
        type: 'expense',
        duplicate: false,
      });
    });

    it('marks a row whose external id already exists', async () => {
      prisma.transaction.findMany.mockImplementation(async (args) => [{ externalId: args.where.externalId.in[0] }]);
      const csv = 'Data;Lançamento;Valor\n01/04/2026;Supermercado;-150,00';

      const response = await request(app.getHttpServer())
        .post('/api/v1/imports/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .field('origin', 'inter')
        .attach('file', Buffer.from(csv, 'utf-8'), 'extrato.csv')
        .expect(201);

      expect(response.body.rows[0].duplicate).toBe(true);
      expect(response.body.duplicateRows).toBe(1);
      expect(response.body.validRows).toBe(0);
    });

    it('rejects unsupported file types with 415', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/imports/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .field('origin', 'inter')
        .attach('file', Buffer.from('test'), 'file.png')
        .expect(415);
    });

    it('requires authentication', async () => {
      const csv = 'Data;Lançamento;Valor\n01/04/2026;Test;-10,00';
      await request(app.getHttpServer())
        .post('/api/v1/imports/preview')
        .field('origin', 'inter')
        .attach('file', Buffer.from(csv, 'utf-8'), 'extrato.csv')
        .expect(401);
    });
  });

  describe('POST /api/v1/imports/:batchId/confirm', () => {
    it('confirms only the server-persisted rows', async () => {
      prisma.importBatch.findUnique.mockResolvedValue(storedBatch() as any);
      prisma.account.findUnique.mockResolvedValue({ id: ACCOUNT_ID, userId: 'user-1', isActive: true } as any);
      prisma.importBatch.updateMany.mockResolvedValue({ count: 1 } as any);
      prisma.transaction.createMany.mockResolvedValue({ count: 1 } as any);
      prisma.importedFile.create.mockResolvedValue({ id: IMPORTED_FILE_ID } as any);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/imports/${BATCH_ID}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ accountId: ACCOUNT_ID, rowNumbers: [1] })
        .expect(201);

      expect(response.body).toMatchObject({
        batchId: BATCH_ID,
        importedFileId: IMPORTED_FILE_ID,
        status: 'completed',
        imported: 1,
      });
      expect(prisma.transaction.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.any(Array), skipDuplicates: true }),
      );
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/imports/${BATCH_ID}/confirm`)
        .send({ accountId: ACCOUNT_ID })
        .expect(401);
    });
  });

  describe('GET /api/v1/imports', () => {
    it('lists imported-file history using the paginated contract', async () => {
      prisma.importedFile.findMany.mockResolvedValue([baseImportedFile] as any);
      prisma.importedFile.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/imports')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.totalItems).toBe(1);
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/imports').expect(401);
    });
  });

  describe('GET /api/v1/imports/:batchId', () => {
    it('reloads a persisted batch preview', async () => {
      prisma.importBatch.findUnique.mockResolvedValue(storedBatch() as any);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/imports/${BATCH_ID}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.batchId).toBe(BATCH_ID);
      expect(response.body.rows[0].date).toBe('2026-04-01');
    });

    it('returns 404 for a missing batch', async () => {
      prisma.importBatch.findUnique.mockResolvedValue(null);
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${BATCH_ID}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('hides another user batch with 404', async () => {
      prisma.importBatch.findUnique.mockResolvedValue({ ...storedBatch(), userId: 'other-user' } as any);
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${BATCH_ID}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
