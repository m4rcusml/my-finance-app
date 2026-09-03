import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import type { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const response = () =>
    ({
      status: jest.fn().mockReturnThis(),
    }) as unknown as Response;

  it('reports ready when PostgreSQL responds', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(prisma as unknown as PrismaService);
    const res = response();

    await expect(controller.ready(res)).resolves.toEqual({
      status: 'ok',
      checks: { database: 'ok' },
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('sets HTTP 503 without exposing the database error', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('secret connection details')) };
    const controller = new HealthController(prisma as unknown as PrismaService);
    const res = response();

    await expect(controller.ready(res)).resolves.toEqual({
      status: 'error',
      checks: { database: 'error' },
    });
    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});
