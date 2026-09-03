import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/v1 (GET) should return 404 because the API has no root route', () => {
    return request(app.getHttpServer()).get('/api/v1').expect(404);
  });

  it('applies request ids through the Nest 11 named wildcard', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect('X-Request-Id', /^[\w-]{1,64}$/)
      .expect(200);
  });
});
