import {
  type ConfirmImportRequest,
  type ConfirmImportResponse,
  IMPORT_FILE_TYPES,
  IMPORT_ORIGINS,
  IMPORT_STATUSES,
  type ImportFileType,
  type ImportOrigin,
  type ImportPreviewResponse,
  type ImportPreviewRow,
  type ImportStatus,
  type ImportedFile,
  TRANSACTION_TYPES,
  type TransactionType,
} from '@finance/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { PaginationMetaDto } from '../common/pagination.dto';

/**
 * Upper bound on `rowNumbers`. The service still checks every number against
 * the batch it belongs to; this only stops an absurd payload from being
 * validated element by element.
 */
export const MAX_SELECTABLE_ROWS = 10_000;

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/**
 * The `multipart/form-data` body of `POST /imports/preview`. The destination
 * account or card is deliberately **not** here: it is chosen on confirm, after
 * the user has seen what the file contains.
 */
export class PreviewImportDto {
  @ApiProperty({
    enum: IMPORT_ORIGINS,
    example: 'inter',
    description: 'Layout esperado do arquivo.',
  })
  @IsIn(IMPORT_ORIGINS, { message: `origin deve ser um destes: ${IMPORT_ORIGINS.join(', ')}.` })
  origin!: ImportOrigin;
}

/**
 * `POST /imports/:batchId/confirm`.
 *
 * There is no room here for transaction data. The rows are read from the batch
 * the server itself parsed and stored — accepting them from the client was the
 * hole that let anyone write arbitrary amounts and dates into their ledger
 * while the file said something else entirely.
 */
export class ConfirmImportDto implements ConfirmImportRequest {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Conta de destino. Informe exatamente um entre accountId e creditCardId.',
  })
  @IsOptional()
  @IsUUID(undefined, { message: 'accountId deve ser um UUID válido.' })
  accountId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Cartão de destino. Informe exatamente um entre accountId e creditCardId.',
  })
  @IsOptional()
  @IsUUID(undefined, { message: 'creditCardId deve ser um UUID válido.' })
  creditCardId?: string | null;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 5],
    description: 'Linhas a importar. Omita para importar todas as linhas válidas e não duplicadas.',
  })
  @IsOptional()
  @IsArray({ message: 'rowNumbers deve ser uma lista de números.' })
  @ArrayMaxSize(MAX_SELECTABLE_ROWS, { message: `rowNumbers aceita no máximo ${MAX_SELECTABLE_ROWS} itens.` })
  @Type(() => Number)
  @IsInt({ each: true, message: 'rowNumbers deve conter apenas números inteiros.' })
  @Min(1, { each: true, message: 'rowNumbers deve conter apenas números positivos.' })
  rowNumbers?: number[];
}

// ---------------------------------------------------------------------------
// Responses (Swagger models; the runtime shapes come from the contracts package)
// ---------------------------------------------------------------------------

export class ImportPreviewRowDto implements ImportPreviewRow {
  @ApiProperty({ example: 1, description: 'Índice 1-based da linha dentro do arquivo.' })
  rowNumber!: number;

  @ApiProperty({ enum: TRANSACTION_TYPES, nullable: true, example: 'expense' })
  type!: TransactionType | null;

  @ApiProperty({ nullable: true, example: 150.9, description: 'Valor absoluto; a direção fica em type.' })
  value!: number | null;

  @ApiProperty({ nullable: true, example: '2026-04-01', description: 'Data civil YYYY-MM-DD.' })
  date!: string | null;

  @ApiProperty({ nullable: true, example: 'Supermercado' })
  description!: string | null;

  @ApiProperty({ nullable: true, description: 'Id determinístico usado na deduplicação.' })
  externalId!: string | null;

  @ApiProperty({ example: false, description: 'Já existe uma transação com este externalId.' })
  duplicate!: boolean;

  @ApiProperty({ type: [String], example: [], description: 'Se não estiver vazio, a linha não pode ser importada.' })
  errors!: string[];
}

export class ImportPreviewResponseDto implements ImportPreviewResponse {
  @ApiProperty({ format: 'uuid' }) batchId!: string;
  @ApiProperty({ example: 'extrato.csv' }) fileName!: string;
  @ApiProperty({ enum: IMPORT_FILE_TYPES }) fileType!: ImportFileType;
  @ApiProperty({ enum: IMPORT_ORIGINS }) origin!: ImportOrigin;
  @ApiProperty({ enum: IMPORT_STATUSES, example: 'pending' }) status!: ImportStatus;

  @ApiProperty({ description: 'Depois deste instante o lote não pode mais ser confirmado.' })
  expiresAt!: string;

  @ApiProperty({ example: 12 }) totalRows!: number;
  @ApiProperty({ example: 10 }) validRows!: number;
  @ApiProperty({ example: 1 }) duplicateRows!: number;
  @ApiProperty({ example: 1 }) invalidRows!: number;

  @ApiProperty({ type: [ImportPreviewRowDto] }) rows!: ImportPreviewRowDto[];
}

export class ConfirmImportResponseDto implements ConfirmImportResponse {
  @ApiProperty({ format: 'uuid' }) batchId!: string;
  @ApiProperty({ format: 'uuid' }) importedFileId!: string;
  @ApiProperty({ enum: IMPORT_STATUSES, example: 'completed' }) status!: ImportStatus;
  @ApiProperty({ example: 10 }) imported!: number;
  @ApiProperty({ example: 1 }) skippedDuplicates!: number;
  @ApiProperty({ example: 1 }) skippedInvalid!: number;
}

export class ImportedFileDto implements ImportedFile {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: IMPORT_ORIGINS }) origin!: ImportOrigin;
  @ApiProperty({ example: 'extrato.csv' }) fileName!: string;
  @ApiProperty({ enum: IMPORT_FILE_TYPES }) fileType!: ImportFileType;
  @ApiProperty({ enum: IMPORT_STATUSES, example: 'completed' }) status!: ImportStatus;
  @ApiProperty() importedAt!: string;
  @ApiProperty({ example: 10 }) totalRecords!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class PaginatedImportedFilesDto {
  @ApiProperty({ type: [ImportedFileDto] }) data!: ImportedFileDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}
