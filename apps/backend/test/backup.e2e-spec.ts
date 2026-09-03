import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { BackupService } from '../src/backup/backup.service';
import { createMockPrismaService, type MockedPrismaService } from '../src/prisma/prisma.mock';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2');

const emptyCounts = {
  accounts: 0,
  creditCards: 0,
  categories: 0,
  transactions: 0,
  fixedTransactions: 0,
  fixedTransactionOccurrences: 0,
  marketAssets: 0,
  investments: 0,
  goals: 0,
  importedFiles: 0,
};

describe('BackupController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: MockedPrismaService;
  let authToken: string;
  let backup: {
    exportBackup: jest.Mock;
    exportFileName: jest.Mock;
    restoreBackup: jest.Mock;
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    name: null,
    tokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const backupFile = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    user: { email: 'test@example.com', name: null },
    accounts: [],
    creditCards: [],
    categories: [],
    transactions: [],
    fixedTransactions: [],
    fixedTransactionOccurrences: [],
    marketAssets: [],
    investments: [],
    goals: [],
    importedFiles: [],
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    backup = {
      exportBackup: jest.fn(),
      exportFileName: jest.fn().mockReturnValue('finance-backup-2026-09-03.json'),
      restoreBackup: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(BackupService)
      .useValue(backup)
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

  it('exports a versioned credential-free JSON download', async () => {
    backup.exportBackup.mockResolvedValue(backupFile);

    const response = await request(app.getHttpServer())
      .get('/api/v1/backup/export')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.schemaVersion).toBe(1);
    expect(response.body.user).toEqual({ email: 'test@example.com', name: null });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.headers['content-disposition']).toContain('finance-backup-2026-09-03.json');
  });

  it('requires authentication to export', async () => {
    await request(app.getHttpServer()).get('/api/v1/backup/export').expect(401);
  });

  it('restores through the current /restore contract', async () => {
    backup.restoreBackup.mockResolvedValue({
      mode: 'merge',
      schemaVersion: 1,
      created: { ...emptyCounts, accounts: 1 },
      deleted: emptyCounts,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/backup/restore')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ mode: 'merge', data: backupFile })
      .expect(200);

    expect(response.body.created.accounts).toBe(1);
    expect(backup.restoreBackup).toHaveBeenCalledWith('user-1', 'merge', backupFile);
  });

  it('validates restore mode before calling the service', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/backup/restore')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ data: backupFile })
      .expect(400);

    expect(backup.restoreBackup).not.toHaveBeenCalled();
  });

  it('requires authentication to restore', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/backup/restore')
      .send({ mode: 'replace', data: backupFile })
      .expect(401);
  });
});
