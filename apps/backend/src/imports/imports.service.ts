import {
  type ConfirmImportResponse,
  type ImportedFile as ImportedFileResource,
  type ImportFileType,
  type ImportOrigin,
  type ImportPreviewResponse,
  type ImportPreviewRow,
  type ImportStatus,
  type PaginatedResponse,
  type TransactionType,
} from '@finance/contracts';
import { BadRequestException, ConflictException, HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromCivilDate, toCivilDate } from '../common/civil-date';
import { toMoney } from '../common/money';
import { assertOwned } from '../common/ownership';
import { buildPaginatedResponse, type PaginationQueryDto, resolvePagination } from '../common/pagination.dto';
import { assertTransactionRelationsWritable } from '../common/writable-transaction-relations';
import type { EnvConfig } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { buildExternalId, hashFileContents } from './external-id';
import { resolveImportFileType, sanitiseFileName } from './file-type';
import type { UploadedImportFile } from './import-file.pipe';
import type { ConfirmImportDto, PreviewImportDto } from './imports.dto';
import { getParser } from './parsers/parser.factory';
import { getStrategy } from './strategies/strategy.factory';

/** Fallbacks used only if the typed config is somehow absent (unit tests). */
const DEFAULT_MAX_IMPORT_ROWS = 5000;
const DEFAULT_TTL_MINUTES = 60;
/** How many external ids go into a single `IN (...)` when checking duplicates. */
const DUPLICATE_LOOKUP_CHUNK = 500;

/** A parsed row held in memory between parsing and persisting the batch. */
interface PreparedRow extends ImportPreviewRow {
  sourceId: string | null;
}

/** The persisted row shape both `confirm` and `findBatch` read back. */
interface StoredBatchRow {
  rowNumber: number;
  type: TransactionType | null;
  value: unknown;
  date: Date | null;
  description: string | null;
  externalId: string | null;
  duplicate: boolean;
  errors: string[];
}

interface StoredBatch {
  id: string;
  userId: string;
  origin: ImportOrigin;
  fileName: string;
  fileType: ImportFileType;
  status: ImportStatus;
  totalRows: number;
  expiresAt: Date;
}

/**
 * Server-side, two-step import.
 *
 * `preview` parses the upload, stores an `ImportBatch` plus one
 * `ImportBatchRow` per parsed line, and answers with what it found.
 * `confirm` then reads **those stored rows** and writes transactions. The
 * client never sends transaction data: the previous `POST /imports/confirm`
 * accepted an `items[]` array and wrote it verbatim, so the file shown in the
 * preview had no bearing on what actually landed in the ledger.
 */
@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  private get maxImportRows(): number {
    return Number(this.config.get('MAX_IMPORT_ROWS', { infer: true }) ?? DEFAULT_MAX_IMPORT_ROWS);
  }

  private get batchTtlMinutes(): number {
    return Number(this.config.get('IMPORT_BATCH_TTL_MINUTES', { infer: true }) ?? DEFAULT_TTL_MINUTES);
  }

  // -------------------------------------------------------------------------
  // Step 1 — preview
  // -------------------------------------------------------------------------

  async preview(userId: string, file: UploadedImportFile, dto: PreviewImportDto): Promise<ImportPreviewResponse> {
    const fileType = resolveImportFileType(file.originalname, file.buffer);
    const fileName = sanitiseFileName(file.originalname);
    const fileHash = hashFileContents(file.buffer);

    const rawRows = await getParser(fileType).parse(file.buffer);

    const maxRows = this.maxImportRows;
    if (rawRows.length > maxRows) {
      throw new BadRequestException(
        `O arquivo tem ${rawRows.length} lançamentos e o limite é ${maxRows}. Divida o período e envie novamente.`,
      );
    }
    if (rawRows.length === 0) {
      throw new BadRequestException(
        'Nenhum lançamento foi encontrado no arquivo. Confira se ele é o extrato ou a fatura exportada pelo banco.',
      );
    }

    const strategy = getStrategy(dto.origin);
    const rows: PreparedRow[] = rawRows.map((raw) => {
      const normalized = strategy.normalize(raw);
      const errors = [...normalized.errors];
      if (errors.length === 0 && normalized.type === null) {
        errors.push('Não foi possível identificar se o lançamento é receita ou despesa.');
      }

      const importable = errors.length === 0 && normalized.date !== null && normalized.value !== null;
      return {
        rowNumber: normalized.rowNumber,
        type: normalized.type,
        value: normalized.value,
        date: normalized.date,
        description: normalized.description,
        sourceId: normalized.sourceId,
        externalId: importable
          ? buildExternalId({
              origin: dto.origin,
              fileHash,
              rowNumber: normalized.rowNumber,
              // Narrowed by `importable`.
              date: normalized.date as string,
              value: normalized.value as number,
              description: normalized.description,
              sourceId: normalized.sourceId,
            })
          : null,
        duplicate: false,
        errors,
      };
    });

    await this.flagDuplicates(userId, rows);

    const expiresAt = new Date(Date.now() + this.batchTtlMinutes * 60_000);
    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.importBatch.create({
        data: {
          userId,
          origin: dto.origin,
          fileName,
          fileType,
          fileHash,
          status: 'pending',
          totalRows: rows.length,
          expiresAt,
        },
      });

      await tx.importBatchRow.createMany({
        data: rows.map((row) => ({
          batchId: created.id,
          rowNumber: row.rowNumber,
          type: row.type,
          value: row.value,
          date: row.date === null ? null : fromCivilDate(row.date),
          description: row.description,
          externalId: row.externalId,
          duplicate: row.duplicate,
          errors: row.errors,
        })),
      });

      return created;
    });

    return this.buildPreviewResponse(
      {
        id: batch.id,
        fileName,
        fileType,
        origin: dto.origin,
        status: 'pending',
        expiresAt,
      },
      rows.map(toPreviewRow),
    );
  }

  /**
   * Marks rows whose `externalId` the user already has, and rows that repeat
   * inside the very same file. Both are surfaced in the preview; neither is
   * imported. The database still has the final word — the partial unique index
   * on `(user_id, external_id)` is what makes a concurrent double-confirm safe.
   */
  private async flagDuplicates(userId: string, rows: PreparedRow[]): Promise<void> {
    const externalIds = rows.map((row) => row.externalId).filter((id): id is string => id !== null);
    if (externalIds.length === 0) return;

    const existing = await this.findExistingExternalIds(userId, externalIds);
    const seenInFile = new Set<string>();

    for (const row of rows) {
      if (row.externalId === null) continue;
      row.duplicate = existing.has(row.externalId) || seenInFile.has(row.externalId);
      seenInFile.add(row.externalId);
    }
  }

  private async findExistingExternalIds(userId: string, externalIds: string[]): Promise<Set<string>> {
    const unique = [...new Set(externalIds)];
    const found = new Set<string>();

    for (let start = 0; start < unique.length; start += DUPLICATE_LOOKUP_CHUNK) {
      const chunk = unique.slice(start, start + DUPLICATE_LOOKUP_CHUNK);
      const matches = await this.prisma.transaction.findMany({
        where: { userId, externalId: { in: chunk } },
        select: { externalId: true },
        take: chunk.length,
      });
      for (const match of matches) {
        if (match.externalId) found.add(match.externalId);
      }
    }
    return found;
  }

  // -------------------------------------------------------------------------
  // Step 2 — confirm
  // -------------------------------------------------------------------------

  async confirm(userId: string, batchId: string, dto: ConfirmImportDto): Promise<ConfirmImportResponse> {
    const batch = await this.loadBatch(userId, batchId);
    await this.assertConfirmable(batch);

    const accountId = dto.accountId ?? null;
    const creditCardId = dto.creditCardId ?? null;
    if ((accountId === null) === (creditCardId === null)) {
      throw new BadRequestException('Informe exatamente um destino: accountId ou creditCardId.');
    }
    const rows = batch.rows;
    const selection = selectRows(rows, dto.rowNumbers);
    if (selection.candidates.length === 0) {
      throw new BadRequestException('Não há linhas válidas e não duplicadas para importar neste lote.');
    }

    const payload: TransactionInput[] = [];
    let skippedInvalid = selection.skippedInvalid;
    for (const row of selection.candidates) {
      const input = toTransactionInput(userId, batch.id, accountId, creditCardId, row);
      // A stored row without date, value or type cannot happen while `errors`
      // is empty; if it ever does, skip it rather than writing a broken ledger.
      if (input === null) {
        skippedInvalid += 1;
        continue;
      }
      payload.push(input);
    }
    if (payload.length === 0) {
      throw new BadRequestException('Não há linhas válidas e não duplicadas para importar neste lote.');
    }

    const importedAt = new Date();
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Compare-and-swap on the status: a second confirm racing this one
        // updates zero rows and stops here, before anything is written.
        const claimed = await tx.importBatch.updateMany({
          where: { id: batch.id, userId, status: 'pending' },
          data: { status: 'processing' },
        });
        if (claimed.count === 0) {
          throw new ConflictException('Esta importação já foi confirmada.');
        }

        await assertTransactionRelationsWritable(tx, userId, {
          accountId,
          creditCardId,
          categoryId: null,
          type: payload[0].type,
        });

        // `skipDuplicates` turns the partial unique index into the deduplicator:
        // re-importing the same file inserts nothing instead of exploding.
        const created = await tx.transaction.createMany({ data: payload, skipDuplicates: true });

        const importedFile = await tx.importedFile.create({
          data: {
            userId,
            batchId: batch.id,
            origin: batch.origin,
            fileName: batch.fileName,
            fileType: batch.fileType,
            status: 'completed',
            importedAt,
            totalRecords: created.count,
          },
        });

        await tx.importBatch.update({
          where: { id: batch.id },
          data: { status: 'completed', confirmedAt: importedAt },
        });

        return { importedFileId: importedFile.id, imported: created.count };
      });

      return {
        batchId: batch.id,
        importedFileId: result.importedFileId,
        status: 'completed',
        imported: result.imported,
        // Rows the preview already knew were duplicates, plus the ones the
        // unique index rejected between preview and confirm.
        skippedDuplicates: selection.skippedDuplicates + (payload.length - result.imported),
        skippedInvalid,
      };
    } catch (error) {
      // A validation refusal leaves the batch pending so the user can retry;
      // only a genuine write failure burns it.
      if (!(error instanceof HttpException)) {
        this.logger.error(`Import batch ${batch.id} failed`, error instanceof Error ? error.stack : undefined);
        await this.markFailed(batch.id);
      }
      throw error;
    }
  }

  private async assertConfirmable(batch: StoredBatch): Promise<void> {
    if (batch.status === 'completed') {
      throw new ConflictException('Esta importação já foi confirmada.');
    }
    if (batch.status === 'processing') {
      throw new ConflictException('Esta importação já está sendo processada.');
    }
    if (batch.status === 'failed') {
      throw new BadRequestException('Esta importação falhou. Envie o arquivo novamente.');
    }
    if (batch.status === 'expired' || isExpired(batch.expiresAt)) {
      await this.markExpired(batch.id);
      throw new BadRequestException('Esta importação expirou. Envie o arquivo novamente.');
    }
  }

  private async markExpired(batchId: string): Promise<void> {
    try {
      await this.prisma.importBatch.updateMany({
        where: { id: batchId, status: 'pending' },
        data: { status: 'expired' },
      });
    } catch {
      // Bookkeeping only: the caller's error is the one that matters.
    }
  }

  private async markFailed(batchId: string): Promise<void> {
    try {
      await this.prisma.importBatch.update({ where: { id: batchId }, data: { status: 'failed' } });
    } catch {
      // Bookkeeping only: the caller's error is the one that matters.
    }
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /** Re-reads a stored preview, so a page reload does not need a re-upload. */
  async findBatch(userId: string, batchId: string): Promise<ImportPreviewResponse> {
    const batch = await this.loadBatch(userId, batchId);
    const status: ImportStatus = batch.status === 'pending' && isExpired(batch.expiresAt) ? 'expired' : batch.status;

    return this.buildPreviewResponse(
      {
        id: batch.id,
        fileName: batch.fileName,
        fileType: batch.fileType,
        origin: batch.origin,
        status,
        expiresAt: batch.expiresAt,
      },
      batch.rows.map(storedRowToPreviewRow),
    );
  }

  async listImportedFiles(userId: string, query: PaginationQueryDto): Promise<PaginatedResponse<ImportedFileResource>> {
    const { page, limit, skip } = resolvePagination(query);

    const [files, totalItems] = await Promise.all([
      this.prisma.importedFile.findMany({
        where: { userId },
        orderBy: [{ importedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.importedFile.count({ where: { userId } }),
    ]);

    return buildPaginatedResponse(files.map(toImportedFileResource), totalItems, page, limit);
  }

  private async loadBatch(userId: string, batchId: string): Promise<StoredBatch & { rows: StoredBatchRow[] }> {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      include: { rows: { orderBy: { rowNumber: 'asc' }, take: this.maxImportRows } },
    });
    const owned = assertOwned(batch, userId, 'Importação');
    return { ...owned, rows: owned.rows ?? [] };
  }

  private buildPreviewResponse(
    batch: {
      id: string;
      fileName: string;
      fileType: ImportFileType;
      origin: ImportOrigin;
      status: ImportStatus;
      expiresAt: Date;
    },
    rows: ImportPreviewRow[],
  ): ImportPreviewResponse {
    const invalidRows = rows.filter((row) => row.errors.length > 0).length;
    const duplicateRows = rows.filter((row) => row.errors.length === 0 && row.duplicate).length;

    return {
      batchId: batch.id,
      fileName: batch.fileName,
      fileType: batch.fileType,
      origin: batch.origin,
      status: batch.status,
      expiresAt: batch.expiresAt.toISOString(),
      totalRows: rows.length,
      validRows: rows.length - invalidRows - duplicateRows,
      duplicateRows,
      invalidRows,
      rows,
    };
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

interface TransactionInput {
  userId: string;
  type: TransactionType;
  value: number;
  date: Date;
  accountId: string | null;
  creditCardId: string | null;
  categoryId: null;
  description: string | null;
  source: 'imported';
  externalId: string | null;
  importBatchId: string;
}

function isExpired(expiresAt: Date | string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

function toPreviewRow(row: PreparedRow): ImportPreviewRow {
  return {
    rowNumber: row.rowNumber,
    type: row.type,
    value: row.value,
    date: row.date,
    description: row.description,
    externalId: row.externalId,
    duplicate: row.duplicate,
    errors: row.errors,
  };
}

function storedRowToPreviewRow(row: StoredBatchRow): ImportPreviewRow {
  return {
    rowNumber: row.rowNumber,
    type: row.type,
    value: row.value === null || row.value === undefined ? null : toMoney(row.value),
    date: row.date === null ? null : toCivilDate(row.date),
    description: row.description,
    externalId: row.externalId,
    duplicate: row.duplicate,
    errors: row.errors ?? [],
  };
}

function toImportedFileResource(file: {
  id: string;
  origin: ImportOrigin;
  fileName: string;
  fileType: ImportFileType;
  status: ImportStatus;
  importedAt: Date;
  totalRecords: number;
  createdAt: Date;
  updatedAt: Date;
}): ImportedFileResource {
  return {
    id: file.id,
    origin: file.origin,
    fileName: file.fileName,
    fileType: file.fileType,
    status: file.status,
    importedAt: new Date(file.importedAt).toISOString(),
    totalRecords: file.totalRecords,
    createdAt: new Date(file.createdAt).toISOString(),
    updatedAt: new Date(file.updatedAt).toISOString(),
  };
}

function toTransactionInput(
  userId: string,
  batchId: string,
  accountId: string | null,
  creditCardId: string | null,
  row: StoredBatchRow,
): TransactionInput | null {
  if (row.type === null || row.value === null || row.value === undefined || row.date === null) return null;

  return {
    userId,
    type: row.type,
    value: toMoney(row.value),
    // The stored column is `date`; round-tripping through the civil form keeps
    // it at UTC midnight no matter what the driver handed back.
    date: fromCivilDate(toCivilDate(row.date)),
    accountId,
    creditCardId,
    categoryId: null,
    description: row.description,
    source: 'imported',
    externalId: row.externalId,
    importBatchId: batchId,
  };
}

interface RowSelection {
  candidates: StoredBatchRow[];
  skippedInvalid: number;
  skippedDuplicates: number;
}

/**
 * Decides which stored rows get written.
 *
 * With no `rowNumbers` the whole batch is taken minus its bad and duplicate
 * rows. With an explicit list every number has to be real, clean and unique —
 * asking for a broken row is a client bug, and answering 400 says so instead of
 * quietly importing something else.
 */
function selectRows(rows: StoredBatchRow[], rowNumbers?: number[]): RowSelection {
  if (rowNumbers === undefined) {
    return {
      candidates: rows.filter((row) => row.errors.length === 0 && !row.duplicate),
      skippedInvalid: rows.filter((row) => row.errors.length > 0).length,
      skippedDuplicates: rows.filter((row) => row.errors.length === 0 && row.duplicate).length,
    };
  }

  if (rowNumbers.length === 0) {
    throw new BadRequestException('rowNumbers não pode ser uma lista vazia.');
  }

  const byNumber = new Map(rows.map((row) => [row.rowNumber, row]));
  const candidates: StoredBatchRow[] = [];
  const unknown: number[] = [];
  const invalid: number[] = [];
  const duplicated: number[] = [];

  for (const rowNumber of new Set(rowNumbers)) {
    const row = byNumber.get(rowNumber);
    if (!row) {
      unknown.push(rowNumber);
    } else if (row.errors.length > 0) {
      invalid.push(rowNumber);
    } else if (row.duplicate) {
      duplicated.push(rowNumber);
    } else {
      candidates.push(row);
    }
  }

  if (unknown.length > 0) {
    throw new BadRequestException(`Linhas inexistentes neste lote: ${formatRowNumbers(unknown)}.`);
  }
  if (invalid.length > 0) {
    throw new BadRequestException(`Linhas com erro não podem ser importadas: ${formatRowNumbers(invalid)}.`);
  }
  if (duplicated.length > 0) {
    throw new BadRequestException(`Linhas duplicadas não podem ser importadas: ${formatRowNumbers(duplicated)}.`);
  }

  return { candidates, skippedInvalid: 0, skippedDuplicates: 0 };
}

/** Keeps an error message short when the client asked for hundreds of bad rows. */
function formatRowNumbers(rowNumbers: number[]): string {
  const shown = rowNumbers.slice(0, 10).join(', ');
  return rowNumbers.length > 10 ? `${shown} e mais ${rowNumbers.length - 10}` : shown;
}
