import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env';
import { createMockPrismaService, type MockedPrismaService } from '../prisma/prisma.mock';
import type { UploadedImportFile } from './import-file.pipe';
import { ImportsService } from './imports.service';
import { CsvParser } from './parsers/csv.parser';
import { OfxParser } from './parsers/ofx.parser';
import { getParser } from './parsers/parser.factory';
import { XlsxParser } from './parsers/xlsx.parser';
import { GenericBankStrategy } from './strategies/generic-bank.strategy';
import { InterStrategy } from './strategies/inter.strategy';
import { getStrategy } from './strategies/strategy.factory';

describe('ImportsService', () => {
  let service: ImportsService;
  let prisma: MockedPrismaService;

  const userId = 'user-1';
  const batchId = 'batch-1';
  const accountId = 'account-1';
  const creditCardId = 'card-1';
  const expiresAt = new Date('2099-01-01T00:00:00.000Z');

  const validStoredRow = {
    rowNumber: 1,
    type: 'expense' as const,
    value: 150,
    date: new Date('2025-01-15T00:00:00.000Z'),
    description: 'Supermercado',
    externalId: 'external-1',
    duplicate: false,
    errors: [] as string[],
  };

  const storedBatch = {
    id: batchId,
    userId,
    origin: 'inter' as const,
    fileName: 'extrato.csv',
    fileType: 'csv' as const,
    status: 'pending' as const,
    totalRows: 1,
    expiresAt,
    rows: [validStoredRow],
  };

  const csvFile = (content: string, originalname = 'extrato.csv'): UploadedImportFile => {
    const buffer = Buffer.from(content, 'utf8');
    return { buffer, originalname, mimetype: 'text/csv', size: buffer.length };
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    const config = {
      get: jest.fn((key: keyof EnvConfig) => {
        if (key === 'MAX_IMPORT_ROWS') return 5000;
        if (key === 'IMPORT_BATCH_TTL_MINUTES') return 60;
        return undefined;
      }),
    } as unknown as ConfigService<EnvConfig, true>;

    service = new ImportsService(prisma, config);
    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.importBatch.create.mockResolvedValue({ id: batchId });
    prisma.importBatchRow.createMany.mockResolvedValue({ count: 1 });
  });

  describe('parser and strategy dispatch', () => {
    it('selects parsers from the resolved contract file type', () => {
      expect(getParser('csv')).toBeInstanceOf(CsvParser);
      expect(getParser('xlsx')).toBeInstanceOf(XlsxParser);
      expect(getParser('ofx')).toBeInstanceOf(OfxParser);
    });

    it('selects only supported bank strategies', () => {
      expect(getStrategy('inter')).toBeInstanceOf(InterStrategy);
      expect(getStrategy('generic')).toBeInstanceOf(GenericBankStrategy);
    });

    it('parses CSV rows with stable 1-based row numbers', async () => {
      const rows = await getParser('csv').parse(
        Buffer.from('Data;Lançamento;Valor\n01/01/2025;Compra;-50,00\n02/01/2025;Venda;30,00'),
      );

      expect(rows).toEqual([
        { rowNumber: 1, data: { Data: '01/01/2025', Lançamento: 'Compra', Valor: '-50,00' } },
        { rowNumber: 2, data: { Data: '02/01/2025', Lançamento: 'Venda', Valor: '30,00' } },
      ]);
    });

    it('normalizes Inter rows and returns structured errors instead of dropping invalid rows', () => {
      const strategy = getStrategy('inter');

      expect(
        strategy.normalize({
          rowNumber: 7,
          data: { Data: '15/01/2025', Lançamento: 'Supermercado', Valor: '-150,00' },
        }),
      ).toEqual({
        rowNumber: 7,
        date: '2025-01-15',
        description: 'Supermercado',
        value: 150,
        type: 'expense',
        sourceId: null,
        errors: [],
      });

      expect(strategy.normalize({ rowNumber: 8, data: { Data: '', Valor: '' } })).toEqual(
        expect.objectContaining({
          rowNumber: 8,
          date: null,
          value: null,
          errors: ['Data ausente.', 'Valor ausente.'],
        }),
      );
    });
  });

  describe('preview', () => {
    it('persists a server-owned batch and returns the current preview contract', async () => {
      const result = await service.preview(
        userId,
        csvFile(
          'Data;Lançamento;Valor\n15/01/2025;Supermercado;-150,00\n16/01/2025;Salário;5000,00',
          '../../extrato.csv',
        ),
        { origin: 'inter' },
      );

      expect(result).toMatchObject({
        batchId,
        fileName: 'extrato.csv',
        fileType: 'csv',
        origin: 'inter',
        status: 'pending',
        totalRows: 2,
        validRows: 2,
        duplicateRows: 0,
        invalidRows: 0,
      });
      expect(result.rows[0]).toMatchObject({
        rowNumber: 1,
        date: '2025-01-15',
        description: 'Supermercado',
        value: 150,
        type: 'expense',
        duplicate: false,
        errors: [],
      });
      expect(prisma.importBatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId, fileName: 'extrato.csv', totalRows: 2 }),
      });
      expect(prisma.importBatchRow.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ batchId, rowNumber: 1, date: new Date('2025-01-15T00:00:00.000Z') }),
        ]),
      });
    });

    it('flags a repeated source id inside the uploaded file', async () => {
      const result = await service.preview(
        userId,
        csvFile('Id;Data;Lançamento;Valor\ntxn-123;15/01/2025;Mercado;-150,00\ntxn-123;15/01/2025;Mercado;-150,00'),
        { origin: 'inter' },
      );

      expect(result.rows.map((row) => row.duplicate)).toEqual([false, true]);
      expect(result.duplicateRows).toBe(1);
      expect(result.validRows).toBe(1);
    });

    it('flags an external id already present in the ledger', async () => {
      prisma.transaction.findMany.mockImplementation(async (args) => [{ externalId: args.where.externalId.in[0] }]);

      const result = await service.preview(
        userId,
        csvFile('Id;Data;Lançamento;Valor\ntxn-123;15/01/2025;Mercado;-150,00'),
        { origin: 'inter' },
      );

      expect(result.rows[0].duplicate).toBe(true);
      expect(result.duplicateRows).toBe(1);
    });

    it('rejects extension/content disagreement before persisting a batch', async () => {
      await expect(
        service.preview(userId, csvFile('not an image', 'extrato.png'), { origin: 'inter' }),
      ).rejects.toThrow(UnsupportedMediaTypeException);
      expect(prisma.importBatch.create).not.toHaveBeenCalled();
    });
  });

  describe('confirm', () => {
    beforeEach(() => {
      prisma.importBatch.findUnique.mockResolvedValue(storedBatch);
      prisma.account.findUnique.mockResolvedValue({ id: accountId, userId, isActive: true });
      prisma.importBatch.updateMany.mockResolvedValue({ count: 1 });
      prisma.transaction.createMany.mockResolvedValue({ count: 1 });
      prisma.importedFile.create.mockResolvedValue({ id: 'imported-file-1' });
      prisma.importBatch.update.mockResolvedValue({});
    });

    it('imports only persisted rows in one transaction and records the completed file', async () => {
      const result = await service.confirm(userId, batchId, { accountId });

      expect(prisma.importBatch.updateMany).toHaveBeenCalledWith({
        where: { id: batchId, userId, status: 'pending' },
        data: { status: 'processing' },
      });
      expect(prisma.transaction.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId,
            type: 'expense',
            value: 150,
            date: new Date('2025-01-15T00:00:00.000Z'),
            accountId,
            creditCardId: null,
            categoryId: null,
            description: 'Supermercado',
            source: 'imported',
            externalId: 'external-1',
            importBatchId: batchId,
          },
        ],
        skipDuplicates: true,
      });
      expect(prisma.importedFile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          batchId,
          status: 'completed',
          totalRecords: 1,
        }),
      });
      expect(result).toEqual({
        batchId,
        importedFileId: 'imported-file-1',
        status: 'completed',
        imported: 1,
        skippedDuplicates: 0,
        skippedInvalid: 0,
      });
    });

    it('counts stored invalid/duplicate rows and database-level races as skipped', async () => {
      prisma.importBatch.findUnique.mockResolvedValue({
        ...storedBatch,
        rows: [
          validStoredRow,
          { ...validStoredRow, rowNumber: 2, externalId: 'external-2', duplicate: true },
          { ...validStoredRow, rowNumber: 3, externalId: null, errors: ['Data inválida.'] },
        ],
      });
      prisma.transaction.createMany.mockResolvedValue({ count: 0 });

      await expect(service.confirm(userId, batchId, { accountId })).resolves.toMatchObject({
        imported: 0,
        skippedDuplicates: 2,
        skippedInvalid: 1,
      });
    });

    it('rejects tampered row selections without writing anything', async () => {
      await expect(service.confirm(userId, batchId, { accountId, rowNumbers: [999] })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.importBatch.updateMany).not.toHaveBeenCalled();
      expect(prisma.transaction.createMany).not.toHaveBeenCalled();
    });

    it('requires exactly one active, owned destination', async () => {
      await expect(service.confirm(userId, batchId, {})).rejects.toThrow(BadRequestException);
      await expect(service.confirm(userId, batchId, { accountId, creditCardId: 'card-1' })).rejects.toThrow(
        BadRequestException,
      );

      prisma.account.findUnique.mockResolvedValue({ id: accountId, userId: 'other-user', isActive: true });
      await expect(service.confirm(userId, batchId, { accountId })).rejects.toThrow(NotFoundException);
    });

    it('revalidates the destination after claiming the batch inside the transaction', async () => {
      let inTransaction = false;
      prisma.$transaction.mockImplementation(async (callback: (tx: MockedPrismaService) => Promise<unknown>) => {
        inTransaction = true;
        try {
          return await callback(prisma);
        } finally {
          inTransaction = false;
        }
      });
      prisma.account.findUnique.mockImplementation(async () => ({
        id: accountId,
        userId,
        isActive: !inTransaction,
      }));

      await expect(service.confirm(userId, batchId, { accountId })).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.createMany).not.toHaveBeenCalled();
    });

    it('revalidates an archived card destination inside the claimed batch transaction', async () => {
      prisma.creditCard.findUnique.mockResolvedValue({ id: creditCardId, userId, isActive: false });

      await expect(service.confirm(userId, batchId, { creditCardId })).rejects.toThrow(BadRequestException);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.createMany).not.toHaveBeenCalled();
    });

    it('lets only one concurrent confirmation claim the pending batch', async () => {
      prisma.importBatch.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.confirm(userId, batchId, { accountId })).rejects.toThrow(ConflictException);
      expect(prisma.transaction.createMany).not.toHaveBeenCalled();
    });

    it('marks an expired batch and asks for a new upload', async () => {
      prisma.importBatch.findUnique.mockResolvedValue({
        ...storedBatch,
        expiresAt: new Date('2000-01-01T00:00:00.000Z'),
      });

      await expect(service.confirm(userId, batchId, { accountId })).rejects.toThrow(BadRequestException);
      expect(prisma.importBatch.updateMany).toHaveBeenCalledWith({
        where: { id: batchId, status: 'pending' },
        data: { status: 'expired' },
      });
      expect(prisma.transaction.createMany).not.toHaveBeenCalled();
    });
  });

  describe('reads', () => {
    it('rebuilds a stored preview after a page reload', async () => {
      prisma.importBatch.findUnique.mockResolvedValue(storedBatch);

      await expect(service.findBatch(userId, batchId)).resolves.toMatchObject({
        batchId,
        totalRows: 1,
        validRows: 1,
        duplicateRows: 0,
        invalidRows: 0,
        rows: [expect.objectContaining({ rowNumber: 1, date: '2025-01-15', value: 150 })],
      });
    });

    it('returns imported files through the shared paginated envelope', async () => {
      const importedAt = new Date('2025-01-15T10:00:00.000Z');
      const createdAt = new Date('2025-01-15T10:01:00.000Z');
      const updatedAt = new Date('2025-01-15T10:02:00.000Z');
      prisma.importedFile.findMany.mockResolvedValue([
        {
          id: 'imported-file-1',
          userId,
          origin: 'inter',
          fileName: 'extrato.csv',
          fileType: 'csv',
          status: 'completed',
          importedAt,
          totalRecords: 2,
          createdAt,
          updatedAt,
        },
      ]);
      prisma.importedFile.count.mockResolvedValue(1);

      const result = await service.listImportedFiles(userId, { page: 2, limit: 5 });

      expect(prisma.importedFile.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: [{ importedAt: 'desc' }, { id: 'desc' }],
        skip: 5,
        take: 5,
      });
      expect(result.data[0]).toEqual({
        id: 'imported-file-1',
        origin: 'inter',
        fileName: 'extrato.csv',
        fileType: 'csv',
        status: 'completed',
        importedAt: importedAt.toISOString(),
        totalRecords: 2,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
      expect(result.meta).toMatchObject({ page: 2, limit: 5, totalItems: 1 });
    });

    it('returns 404 for a missing or cross-tenant batch', async () => {
      prisma.importBatch.findUnique.mockResolvedValue(null);
      await expect(service.findBatch(userId, batchId)).rejects.toThrow(NotFoundException);

      prisma.importBatch.findUnique.mockResolvedValue({ ...storedBatch, userId: 'other-user' });
      await expect(service.findBatch(userId, batchId)).rejects.toThrow(NotFoundException);
    });
  });
});
