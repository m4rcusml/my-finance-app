import { API_PREFIX } from '@finance/contracts';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/http-exception.filter';
import { RequestIdMiddleware } from '../../src/common/request-id.middleware';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Boots the REAL application against the REAL PostgreSQL started by the Jest
 * global setup. Nothing here is mocked: these tests exercise migrations,
 * constraints, transactions and the HTTP layer exactly as production does.
 */

export const PREFIX = API_PREFIX;

export function testDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? readFileSync(join(__dirname, '.db-url'), 'utf8').trim();
}

export interface TestApp {
  app: NestExpressApplication;
  prisma: PrismaService;
  http: TestAgent;
  close: () => Promise<void>;
}

export async function createTestApp(overrides: Record<string, string> = {}): Promise<TestApp> {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl(),
    JWT_SECRET: 'integration-test-access-secret-value-32-chars-long',
    JWT_REFRESH_SECRET: 'integration-test-refresh-secret-value-32-chars-long',
    CORS_ORIGINS: 'http://localhost:3000',
    APP_TIMEZONE: 'America/Sao_Paulo',
    COOKIE_SECURE: 'false',
    COOKIE_SAMESITE: 'lax',
    ENABLE_CRON: 'false',
    ENABLE_SWAGGER: 'false',
    ...overrides,
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });

  // Mirror main.ts so the tests exercise the same request pipeline.
  app.use(cookieParser());
  app.use((req: never, res: never, next: () => void) => new RequestIdMiddleware().use(req, res, next));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''), { exclude: ['health/live', 'health/ready'] });

  await app.init();

  const prisma = app.get(PrismaService);
  const http = request(app.getHttpServer());

  return {
    app,
    prisma,
    http,
    close: async () => {
      await app.close();
    },
  };
}

/**
 * Truncates every table between tests. `RESTART IDENTITY CASCADE` is fine here
 * because the ids are uuids; the point is a deterministic empty slate that is
 * far faster than re-running migrations.
 */
export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "fixed_transaction_occurrences",
      "import_batch_rows",
      "import_batches",
      "imported_files",
      "transactions",
      "fixed_transactions",
      "investments",
      "market_assets",
      "goals",
      "categories",
      "credit_cards",
      "accounts",
      "refresh_tokens",
      "users"
    RESTART IDENTITY CASCADE
  `);
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  accessToken: string;
  auth: (req: request.Test) => request.Test;
}

let userCounter = 0;

/** Registers a user through the real HTTP API and returns a bearer helper. */
export async function registerUser(http: TestAgent, email?: string): Promise<TestUser> {
  userCounter += 1;
  const address = email ?? `user${userCounter}.${process.pid}@example.com`;
  const password = 'Senha-Muito-Segura-123';

  const res = await http
    .post(`${PREFIX}/auth/register`)
    .send({ email: address, password, name: `Usuário ${userCounter}` })
    .expect((r) => {
      if (r.status !== 201 && r.status !== 200) {
        throw new Error(`register failed (${r.status}): ${JSON.stringify(r.body)}`);
      }
    });

  const accessToken: string = res.body.accessToken;
  return {
    id: res.body.user.id,
    email: address,
    password,
    accessToken,
    auth: (req) => req.set('Authorization', `Bearer ${accessToken}`),
  };
}

/** Convenience: assert a response is the paginated envelope and return it typed. */
export function expectPaginated<T>(body: unknown): { data: T[]; meta: Record<string, unknown> } {
  const value = body as { data?: unknown; meta?: Record<string, unknown> };
  if (!Array.isArray(value?.data) || typeof value?.meta !== 'object' || value.meta === null) {
    throw new Error(`expected a paginated envelope, got: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return { data: value.data as T[], meta: value.meta };
}
