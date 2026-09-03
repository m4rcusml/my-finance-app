import {
  BACKUP_SCHEMA_VERSION,
  RESTORE_MODES,
  type RestoreMode,
  type RestoreResponse,
  type RestoreResultCounts,
} from '@finance/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmptyObject, IsObject } from 'class-validator';

/**
 * Restore request.
 *
 * `mode` is required on purpose: the previous endpoint always merged, which
 * meant "restore my backup" quietly produced a duplicated ledger. `data` stays
 * a raw object here — its 11 collections are validated field by field in
 * `backup.validation.ts` before anything is written, and a nested DTO tree
 * could not express the cross-row rules (relation ids, unique keys) anyway.
 */
export class RestoreBackupDto {
  @ApiProperty({
    enum: RESTORE_MODES,
    description:
      '`replace` apaga os registros atuais e restaura o arquivo; `merge` mantém o que já existe e apenas adiciona.',
    example: 'replace',
  })
  @IsIn(RESTORE_MODES, { message: 'mode deve ser replace ou merge.' })
  mode!: RestoreMode;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: `Conteúdo integral do arquivo gerado por GET /backup/export (schemaVersion ${BACKUP_SCHEMA_VERSION}).`,
  })
  @IsObject({ message: 'data deve ser o conteúdo do arquivo de backup.' })
  @IsNotEmptyObject({ nullable: false }, { message: 'data não pode ser vazio.' })
  data!: Record<string, unknown>;
}

/** Swagger model for the `user` block of an export. Credentials never appear here. */
export class BackupUserDto {
  @ApiProperty({ example: 'pessoa@exemplo.com' })
  email!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Maria' })
  name!: string | null;
}

/**
 * Swagger model for the exported file. The collections are documented as plain
 * object arrays because their authoritative shapes live in `@finance/contracts`
 * (`Account`, `Transaction`, ...) and duplicating them here would only let the
 * documentation drift away from the types the frontend actually compiles with.
 */
export class BackupFileDto {
  @ApiProperty({ enum: [BACKUP_SCHEMA_VERSION], example: BACKUP_SCHEMA_VERSION })
  schemaVersion!: typeof BACKUP_SCHEMA_VERSION;

  @ApiProperty({ format: 'date-time', example: '2026-09-03T12:00:00.000Z' })
  exportedAt!: string;

  @ApiProperty({ type: BackupUserDto })
  user!: BackupUserDto;

  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Contas (`Account[]`).' })
  accounts!: Record<string, unknown>[];

  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Cartões de crédito.' })
  creditCards!: Record<string, unknown>[];

  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Categorias.' })
  categories!: Record<string, unknown>[];

  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Transações.' })
  transactions!: Record<string, unknown>[];

  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Lançamentos fixos.' })
  fixedTransactions!: Record<string, unknown>[];

  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Ocorrências dos lançamentos fixos.' })
  fixedTransactionOccurrences!: Record<string, unknown>[];

  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Ativos do catálogo do usuário.' })
  marketAssets!: Record<string, unknown>[];

  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Investimentos.' })
  investments!: Record<string, unknown>[];

  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Metas.' })
  goals!: Record<string, unknown>[];

  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Histórico de arquivos importados.' })
  importedFiles!: Record<string, unknown>[];
}

export class RestoreResultCountsDto implements RestoreResultCounts {
  @ApiProperty({ example: 3 }) accounts!: number;
  @ApiProperty({ example: 2 }) creditCards!: number;
  @ApiProperty({ example: 12 }) categories!: number;
  @ApiProperty({ example: 840 }) transactions!: number;
  @ApiProperty({ example: 6 }) fixedTransactions!: number;
  @ApiProperty({ example: 72 }) fixedTransactionOccurrences!: number;
  @ApiProperty({ example: 4 }) marketAssets!: number;
  @ApiProperty({ example: 9 }) investments!: number;
  @ApiProperty({ example: 2 }) goals!: number;
  @ApiProperty({ example: 5 }) importedFiles!: number;
}

export class RestoreResponseDto implements RestoreResponse {
  @ApiProperty({ enum: RESTORE_MODES, example: 'replace' })
  mode!: RestoreMode;

  @ApiProperty({ example: BACKUP_SCHEMA_VERSION })
  schemaVersion!: number;

  @ApiProperty({ type: RestoreResultCountsDto, description: 'Linhas efetivamente criadas.' })
  created!: RestoreResultCountsDto;

  @ApiProperty({
    type: RestoreResultCountsDto,
    description: 'Linhas removidas antes da restauração. Sempre zerado no modo `merge`.',
  })
  deleted!: RestoreResultCountsDto;
}
