import { ACCOUNT_TYPES, type Account, type AccountType, type PaginatedResponse } from '@finance/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationMetaDto, PaginationQueryDto } from '../common/pagination.dto';

/**
 * Bounds of `numeric(15, 2)`. Validating here turns a typo into a 400 with a
 * readable message instead of a database error surfacing as a 500.
 */
const MONEY_MAX = 9_999_999_999_999.99;
const MONEY_MIN = -9_999_999_999_999.99;

/**
 * Query strings carry `'true'`/`'false'`, never real booleans, and implicit
 * conversion is switched off globally. Anything else is left untouched so
 * `@IsBoolean()` can reject it instead of it silently becoming `false`.
 */
export function parseOptionalBoolean(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class CreateAccountDto {
  @ApiProperty({ example: 'Conta corrente', maxLength: 120 })
  @IsString()
  @IsNotEmpty({ message: 'name é obrigatório.' })
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'Banco Inter', maxLength: 120 })
  @IsString()
  @IsNotEmpty({ message: 'institution é obrigatório.' })
  @MaxLength(120)
  institution!: string;

  @ApiProperty({ enum: [...ACCOUNT_TYPES], example: 'checking' })
  @IsIn(ACCOUNT_TYPES, { message: `type deve ser um de: ${ACCOUNT_TYPES.join(', ')}.` })
  type!: AccountType;

  @ApiProperty({
    example: 1500.5,
    description: 'Saldo de abertura. Pode ser negativo (conta no cheque especial).',
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'initialBalance deve ter no máximo 2 casas decimais.' })
  @Min(MONEY_MIN)
  @Max(MONEY_MAX)
  initialBalance!: number;
}

/**
 * PATCH: uma chave ausente não é alterada. `null` não limpa nada aqui porque
 * nenhum campo da conta é opcional — por isso `@ValidateIf(!== undefined)` em
 * vez de `@IsOptional()`, que aceitaria `null` silenciosamente.
 */
export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'Conta salário', maxLength: 120 })
  @ValidateIf((o: UpdateAccountDto) => o.name !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'name não pode ser vazio.' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Nubank', maxLength: 120 })
  @ValidateIf((o: UpdateAccountDto) => o.institution !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'institution não pode ser vazio.' })
  @MaxLength(120)
  institution?: string;

  @ApiPropertyOptional({ enum: [...ACCOUNT_TYPES], example: 'savings' })
  @ValidateIf((o: UpdateAccountDto) => o.type !== undefined)
  @IsIn(ACCOUNT_TYPES, { message: `type deve ser um de: ${ACCOUNT_TYPES.join(', ')}.` })
  type?: AccountType;

  @ApiPropertyOptional({ example: 200 })
  @ValidateIf((o: UpdateAccountDto) => o.initialBalance !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'initialBalance deve ter no máximo 2 casas decimais.' })
  @Min(MONEY_MIN)
  @Max(MONEY_MAX)
  initialBalance?: number;
}

export class ListAccountsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Inclui contas arquivadas na listagem.',
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean({ message: 'includeArchived deve ser true ou false.' })
  includeArchived?: boolean;
}

/** Swagger model. `implements Account` makes any drift a compile error. */
export class AccountResponseDto implements Account {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Conta corrente' }) name!: string;
  @ApiProperty({ example: 'Banco Inter' }) institution!: string;
  @ApiProperty({ enum: [...ACCOUNT_TYPES], example: 'checking' }) type!: AccountType;
  @ApiProperty({ example: 1000 }) initialBalance!: number;
  @ApiProperty({ example: 1300, description: 'initialBalance + receitas - despesas.' }) balance!: number;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiProperty({ type: String, nullable: true, example: null }) archivedAt!: string | null;
  @ApiProperty({ example: '2026-01-15T12:00:00.000Z' }) createdAt!: string;
  @ApiProperty({ example: '2026-01-15T12:00:00.000Z' }) updatedAt!: string;
}

export class PaginatedAccountsDto implements PaginatedResponse<Account> {
  @ApiProperty({ type: [AccountResponseDto] }) data!: AccountResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}
