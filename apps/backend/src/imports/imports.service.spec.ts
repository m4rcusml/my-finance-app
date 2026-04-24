import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { ImportsService } from './imports.service';
import { CsvParser } from './parsers/csv.parser';
import { OfxParser } from './parsers/ofx.parser';
import { ParserFactory } from './parsers/parser.factory';
import { XlsxParser } from './parsers/xlsx.parser';
import { StrategyFactory } from './strategies/strategy.factory';

describe('ImportsService', () => {
  let service: ImportsService;
  let prisma: jest.Mocked<PrismaService>;
  let transactionsService: jest.Mocked<TransactionsService>;

  const userId = 'user-1';
  const importId = 'import-1';
  const accountId = 'account-1';

  const baseImportedFile = {
    id: importId,
    userId,
    origin: 'inter',
    fileName: 'extrato.csv',
    fileType: 'csv',
    status: 'completed',
    importedAt: new Date(),
    totalRecords: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportsService,
        {
          provide: PrismaService,
          useValue: {
            importedFile: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
            },
            transaction: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: TransactionsService,
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ImportsService>(ImportsService);
    prisma = module.get(PrismaService);
    transactionsService = module.get(TransactionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('parser layer', () => {
    it('should select CsvParser for CSV files', () => {
      const parser = ParserFactory.getParser('text/csv', 'file.csv');
      expect(parser).toBeInstanceOf(CsvParser);
    });

    it('should select XlsxParser for XLSX files', () => {
      const parser = ParserFactory.getParser(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'file.xlsx',
      );
      expect(parser).toBeInstanceOf(XlsxParser);
    });

    it('should select OfxParser for OFX files', () => {
      const parser = ParserFactory.getParser('application/x-ofx', 'file.ofx');
      expect(parser).toBeInstanceOf(OfxParser);
    });

    it('should throw for unsupported file types', () => {
      expect(() => ParserFactory.getParser('image/png', 'file.png')).toThrow('Unsupported file type');
    });

    it('should parse CSV buffer correctly', async () => {
      const csvContent = 'Data;Lançamento;Valor\n01/01/2025;Compra;50,00\n02/01/2025;Venda;30,00';
      const parser = new CsvParser();
      const rows = await parser.parse(Buffer.from(csvContent, 'utf-8'));
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        Data: '01/01/2025',
        Lançamento: 'Compra',
        Valor: '50,00',
      });
    });
  });

  describe('strategy layer', () => {
    it('should normalize Inter CSV rows', () => {
      const strategy = StrategyFactory.getStrategy('inter');
      const row = {
        Data: '15/01/2025',
        Lançamento: 'Supermercado',
        Valor: '-150,00',
      };
      const result = strategy.normalize(row);
      expect(result).toEqual({
        date: '2025-01-15',
        description: 'Supermercado',
        value: 150,
        type: 'expense',
      });
    });

    it('should normalize Inter income rows', () => {
      const strategy = StrategyFactory.getStrategy('inter');
      const row = {
        Data: '15/01/2025',
        Lançamento: 'Salário',
        Valor: '5000,00',
      };
      const result = strategy.normalize(row);
      expect(result).toEqual({
        date: '2025-01-15',
        description: 'Salário',
        value: 5000,
        type: 'income',
      });
    });

    it('should return null for invalid Inter rows', () => {
      const strategy = StrategyFactory.getStrategy('inter');
      const row = { Data: '', Lançamento: '', Valor: '' };
      const result = strategy.normalize(row);
      expect(result).toBeNull();
    });

    it('should use generic strategy for unknown origins', () => {
      const strategy = StrategyFactory.getStrategy('unknown_bank');
      const row = {
        date: '2025-01-15',
        description: 'Test',
        value: 100,
        type: 'expense',
      };
      const result = strategy.normalize(row);
      expect(result).toEqual({
        date: '2025-01-15',
        description: 'Test',
        value: 100,
        type: 'expense',
      });
    });
  });

  describe('preview', () => {
    it('should return parsed rows with duplicate flags', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);

      const csvContent = 'Data;Lançamento;Valor\n15/01/2025;Supermercado;-150,00\n16/01/2025;Salário;5000,00';
      const file = {
        buffer: Buffer.from(csvContent, 'utf-8'),
        mimetype: 'text/csv',
        originalname: 'extrato.csv',
      } as Express.Multer.File;

      const result = await service.preview(userId, file, { origin: 'inter' });

      expect(result.rows).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.rows[0]).toMatchObject({
        date: '2025-01-15',
        description: 'Supermercado',
        value: 150,
        type: 'expense',
        isDuplicate: false,
      });
      expect(result.rows[1]).toMatchObject({
        date: '2025-01-16',
        description: 'Salário',
        value: 5000,
        type: 'income',
        isDuplicate: false,
      });
    });

    it('should detect duplicate rows by signature', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);

      const csvContent = 'Data;Lançamento;Valor\n15/01/2025;Supermercado;-150,00\n15/01/2025;Supermercado;-150,00';
      const file = {
        buffer: Buffer.from(csvContent, 'utf-8'),
        mimetype: 'text/csv',
        originalname: 'extrato.csv',
      } as Express.Multer.File;

      const result = await service.preview(userId, file, { origin: 'inter' });

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].isDuplicate).toBe(false);
      expect(result.rows[1].isDuplicate).toBe(true);
      expect(result.duplicates).toBe(1);
    });

    it('should detect duplicates against existing transactions', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
        {
          date: new Date('2025-01-15'),
          value: 150,
          description: 'Supermercado',
          externalId: null,
        },
      ]);

      const csvContent = 'Data;Lançamento;Valor\n15/01/2025;Supermercado;-150,00';
      const file = {
        buffer: Buffer.from(csvContent, 'utf-8'),
        mimetype: 'text/csv',
        originalname: 'extrato.csv',
      } as Express.Multer.File;

      const result = await service.preview(userId, file, { origin: 'inter' });

      expect(result.rows[0].isDuplicate).toBe(true);
    });

    it('should detect duplicates by externalId', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
        {
          date: new Date('2025-01-15'),
          value: 150,
          description: 'Supermercado',
          externalId: 'txn-123',
        },
      ]);

      const csvContent = 'Id;Data;Lançamento;Valor\ntxn-123;15/01/2025;Supermercado;-150,00';
      const file = {
        buffer: Buffer.from(csvContent, 'utf-8'),
        mimetype: 'text/csv',
        originalname: 'extrato.csv',
      } as Express.Multer.File;

      const result = await service.preview(userId, file, { origin: 'inter' });

      expect(result.rows[0].isDuplicate).toBe(true);
    });

    it('should throw for unsupported file types', async () => {
      const file = {
        buffer: Buffer.from('test'),
        mimetype: 'image/png',
        originalname: 'file.png',
      } as Express.Multer.File;

      await expect(service.preview(userId, file, { origin: 'inter' })).rejects.toThrow('Unsupported file type');
    });
  });

  describe('confirm', () => {
    it('should create importedFile and transactions', async () => {
      (prisma.importedFile.create as jest.Mock).mockResolvedValue(baseImportedFile);
      (transactionsService.create as jest.Mock).mockResolvedValue({
        id: 'txn-1',
        userId,
        type: 'expense',
        value: 150,
        date: new Date('2025-01-15'),
        accountId,
        description: 'Supermercado',
        source: 'manual',
      });

      const result = await service.confirm(userId, {
        origin: 'inter',
        fileName: 'extrato.csv',
        fileType: 'csv',
        accountId,
        items: [
          {
            date: '2025-01-15',
            description: 'Supermercado',
            value: 150,
            type: 'expense',
          },
        ],
      });

      expect(prisma.importedFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            origin: 'inter',
            fileName: 'extrato.csv',
            fileType: 'csv',
            status: 'completed',
            totalRecords: 1,
          }),
        }),
      );
      expect(transactionsService.create).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          type: 'expense',
          value: 150,
          date: '2025-01-15',
          accountId,
          description: 'Supermercado',
        }),
      );
      expect(result.createdCount).toBe(1);
    });
  });

  describe('findAll', () => {
    it('should return user imports ordered by date', async () => {
      (prisma.importedFile.findMany as jest.Mock).mockResolvedValue([baseImportedFile]);
      (prisma.importedFile.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll(userId, 1, 20);

      expect(prisma.importedFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          orderBy: { importedAt: 'desc' },
        }),
      );
      expect(result.data).toEqual([baseImportedFile]);
      expect(result.meta.totalItems).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return import when found and owned', async () => {
      (prisma.importedFile.findUnique as jest.Mock).mockResolvedValue(baseImportedFile);

      const result = await service.findById(userId, importId);

      expect(prisma.importedFile.findUnique).toHaveBeenCalledWith({
        where: { id: importId },
      });
      expect(result).toEqual(baseImportedFile);
    });

    it('should throw NotFoundException when import not found', async () => {
      (prisma.importedFile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById(userId, importId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when import belongs to another user', async () => {
      (prisma.importedFile.findUnique as jest.Mock).mockResolvedValue({
        ...baseImportedFile,
        userId: 'other-user',
      });

      await expect(service.findById(userId, importId)).rejects.toThrow(ForbiddenException);
    });
  });
});
