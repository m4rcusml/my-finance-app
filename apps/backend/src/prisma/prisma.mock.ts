import type { PrismaService } from './prisma.service';

/**
 * The delegate surface these suites exercise. Every method is a plain `jest.Mock`
 * so specs can call `.mockResolvedValue(...)` without fighting Prisma's generic
 * delegate signatures (which is what produced ~400 `tsc --noEmit` errors before).
 */
export type MockDelegate = {
  create: jest.Mock;
  createMany: jest.Mock;
  findMany: jest.Mock;
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
  upsert: jest.Mock;
  aggregate: jest.Mock;
  groupBy: jest.Mock;
};

const MODELS = [
  'account',
  'category',
  'creditCard',
  'transaction',
  'fixedTransaction',
  'fixedTransactionOccurrence',
  'investment',
  'marketAsset',
  'goal',
  'importedFile',
  'importBatch',
  'importBatchRow',
  'refreshToken',
  'user',
] as const;

export type MockedPrismaService = {
  [K in (typeof MODELS)[number]]: MockDelegate;
} & {
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
} & PrismaService;

function mockDelegate(): MockDelegate {
  return {
    create: jest.fn(),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
    upsert: jest.fn(),
    aggregate: jest.fn().mockResolvedValue({}),
    groupBy: jest.fn().mockResolvedValue([]),
  };
}

/**
 * Creates a mock PrismaService with jest.fn() for all model delegates.
 * Each test can override the specific methods it needs.
 *
 * `$transaction` defaults to running the callback against the same mock client,
 * so services that wrap work in `prisma.$transaction(tx => ...)` behave sanely
 * under test. Array form resolves all promises.
 */
export function createMockPrismaService(): MockedPrismaService {
  const base: Record<string, unknown> = {};
  for (const model of MODELS) base[model] = mockDelegate();

  const client = {
    ...base,
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn(),
  } as unknown as MockedPrismaService;

  (client.$transaction as jest.Mock).mockImplementation(async (arg: unknown) =>
    typeof arg === 'function'
      ? await (arg as (tx: MockedPrismaService) => unknown)(client)
      : await Promise.all(arg as Promise<unknown>[]),
  );

  return client;
}
