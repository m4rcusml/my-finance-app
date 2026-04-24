import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Creates a mock PrismaService with jest.fn() for all model delegates.
 * Each test can override the specific methods it needs.
 */
export function createMockPrismaService(): jest.Mocked<PrismaService> {
  const mockDelegate = () => ({
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  });

  return {
    account: mockDelegate(),
    category: mockDelegate(),
    creditCard: mockDelegate(),
    transaction: mockDelegate(),
    fixedTransaction: mockDelegate(),
    fixedTransactionOccurrence: mockDelegate(),
    investment: mockDelegate(),
    marketAsset: mockDelegate(),
    goal: mockDelegate(),
    importedFile: mockDelegate(),
    user: mockDelegate(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;
}
