import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransactionType } from 'src/transactions/transactions.dto';
import { TransactionsService } from 'src/transactions/transactions.service';
import { buildPaginatedResponse } from '../shared/pagination.dto';
import type { ConfirmImportDto, PreviewImportDto } from './imports.dto';
import { ParserFactory } from './parsers/parser.factory';
import type { FileParser } from './parsers/parser.interface';
import type { ParsedTransaction } from './strategies/bank-strategy.interface';
import { StrategyFactory } from './strategies/strategy.factory';

export interface PreviewItem extends ParsedTransaction {
  isDuplicate: boolean;
}

export interface PreviewResponse {
  rows: PreviewItem[];
  total: number;
  duplicates: number;
}

export interface MulterFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async preview(userId: string, file: MulterFile, dto: PreviewImportDto): Promise<PreviewResponse> {
    let parser: FileParser;
    try {
      parser = ParserFactory.getParser(file.mimetype, file.originalname);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    const rawRows = await parser.parse(file.buffer);

    const strategy = StrategyFactory.getStrategy(dto.origin);
    const parsedRows: ParsedTransaction[] = [];

    for (const row of rawRows) {
      const normalized = strategy.normalize(row);
      if (normalized) {
        parsedRows.push(normalized);
      }
    }

    const duplicates = await this.detectDuplicates(userId, parsedRows);

    const rows: PreviewItem[] = parsedRows.map((row, index) => ({
      ...row,
      isDuplicate: duplicates.has(index),
    }));

    return {
      rows,
      total: rows.length,
      duplicates: duplicates.size,
    };
  }

  async confirm(userId: string, dto: ConfirmImportDto) {
    const { items, origin, fileName, fileType } = dto;

    const importedFile = await this.prisma.importedFile.create({
      data: {
        userId,
        origin,
        fileName,
        fileType,
        status: 'completed',
        importedAt: new Date(),
        totalRecords: items.length,
      },
    });

    const createdTransactions: Awaited<ReturnType<typeof this.transactionsService.create>>[] = [];
    for (const item of items) {
      const transaction = await this.transactionsService.create(userId, {
        type: item.type as TransactionType,
        value: item.value,
        date: item.date,
        accountId: dto.accountId,
        creditCardId: dto.creditCardId,
        description: item.description,
      });
      createdTransactions.push(transaction);
    }

    return {
      importedFile,
      createdCount: createdTransactions.length,
    };
  }

  async findAll(userId: string, page = 1, limit = 20) {
    const [importedFiles, total] = await Promise.all([
      this.prisma.importedFile.findMany({
        where: { userId },
        orderBy: { importedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.importedFile.count({ where: { userId } }),
    ]);

    return buildPaginatedResponse(importedFiles, total, page, limit);
  }

  async findById(userId: string, id: string) {
    const importedFile = await this.prisma.importedFile.findUnique({
      where: { id },
    });

    if (!importedFile) {
      throw new NotFoundException();
    }

    if (importedFile.userId !== userId) {
      throw new ForbiddenException();
    }

    return importedFile;
  }

  private async detectDuplicates(userId: string, rows: ParsedTransaction[]): Promise<Set<number>> {
    const duplicates = new Set<number>();

    // Build lookup sets for efficient comparison
    const externalIds = new Set<string>();
    const signatures = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.externalId) {
        const key = `ext:${row.externalId}`;
        if (externalIds.has(key)) {
          duplicates.add(i);
        } else {
          externalIds.add(key);
        }
      }
      const sig = this.buildSignature(row.date, row.value, row.description);
      if (signatures.has(sig)) {
        duplicates.add(i);
      } else {
        signatures.add(sig);
      }
    }

    // Check against existing transactions in DB
    const existingTransactions = await this.prisma.transaction.findMany({
      where: { userId },
      select: {
        externalId: true,
        date: true,
        value: true,
        description: true,
      },
    });

    for (let i = 0; i < rows.length; i++) {
      if (duplicates.has(i)) continue;

      const row = rows[i];
      for (const existing of existingTransactions) {
        // Match by externalId
        if (row.externalId && existing.externalId === row.externalId) {
          duplicates.add(i);
          break;
        }
        // Match by signature
        const existingSig = this.buildSignature(
          existing.date instanceof Date ? existing.date.toISOString().split('T')[0] : String(existing.date),
          Number(existing.value),
          existing.description ?? '',
        );
        if (this.buildSignature(row.date, row.value, row.description) === existingSig) {
          duplicates.add(i);
          break;
        }
      }
    }

    return duplicates;
  }

  private buildSignature(date: string, value: number, description: string): string {
    const normalizedDesc = description.toLowerCase().trim();
    return `${date}|${value}|${normalizedDesc}`;
  }
}
