import {
  type Category,
  CATEGORY_TYPES,
  type CategoryType,
  CIVIL_DATE_PATTERN,
  type CivilDate,
  type FixedTransaction,
  type FixedTransactionOccurrence,
  FIXED_TRANSACTION_TYPES,
  type FixedTransactionType,
  type IsoTimestamp,
  type Money,
  OCCURRENCE_STATUSES,
  type OccurrenceStatus,
  type OccurrenceWithTemplate,
  type PaginatedResponse,
} from '@finance/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateIf,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { PaginationMetaDto, PaginationQueryDto } from '../common/pagination.dto';

/** `numeric(15,2)` tops out here; anything larger is a typo, not a payment. */
export const MAX_MONEY = 9_999_999_999_999.99;
export const MIN_REFERENCE_DAY = 1;
export const MAX_REFERENCE_DAY = 31;
export const MIN_MARGIN_DAYS = 0;
export const MAX_MARGIN_DAYS = 15;
export const MAX_DESCRIPTION_LENGTH = 255;

const CIVIL_DATE_MESSAGE = 'deve ser uma data civil no formato YYYY-MM-DD';

/**
 * A recurrence template is paid from an account **or** charged to a card, never
 * both and never neither — the same rule the `fixed_transactions` CHECK
 * constraint enforces in PostgreSQL. Validating it here turns what used to be a
 * 500 from the database into a readable 400.
 */
@ValidatorConstraint({ name: 'exactlyOneFixedTransactionSource', async: false })
export class ExactlyOneSourceConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const object = args.object as { accountId?: string | null; creditCardId?: string | null };
    const hasAccount = typeof object.accountId === 'string' && object.accountId.length > 0;
    const hasCard = typeof object.creditCardId === 'string' && object.creditCardId.length > 0;
    return hasAccount !== hasCard;
  }

  defaultMessage(): string {
    return 'Informe exatamente uma origem: accountId ou creditCardId.';
  }
}

// ---------------------------------------------------------------------------
// Requests — templates
// ---------------------------------------------------------------------------

export class CreateFixedTransactionDto {
  @ApiProperty({ enum: [...FIXED_TRANSACTION_TYPES], description: 'Natureza do lançamento recorrente.' })
  @IsIn(FIXED_TRANSACTION_TYPES, { message: 'type deve ser income ou expense.' })
  type!: FixedTransactionType;

  @ApiProperty({ example: 1250.9, description: 'Valor nominal, em reais, com até 2 casas decimais.' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'value deve ser um número com no máximo 2 casas decimais.' })
  @Min(0.01, { message: 'value deve ser maior que zero.' })
  @Max(MAX_MONEY)
  value!: Money;

  @ApiProperty({
    minimum: MIN_REFERENCE_DAY,
    maximum: MAX_REFERENCE_DAY,
    example: 10,
    description: 'Dia nominal do mês. Meses mais curtos usam o último dia disponível.',
  })
  @Type(() => Number)
  @IsInt({ message: 'referenceDay deve ser um número inteiro.' })
  @Min(MIN_REFERENCE_DAY, { message: 'referenceDay deve estar entre 1 e 31.' })
  @Max(MAX_REFERENCE_DAY, { message: 'referenceDay deve estar entre 1 e 31.' })
  referenceDay!: number;

  @ApiPropertyOptional({
    minimum: MIN_MARGIN_DAYS,
    maximum: MAX_MARGIN_DAYS,
    default: MIN_MARGIN_DAYS,
    description: 'Quantos dias antes/depois do vencimento a confirmação é aceita.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'marginDays deve ser um número inteiro.' })
  @Min(MIN_MARGIN_DAYS, { message: 'marginDays deve estar entre 0 e 15.' })
  @Max(MAX_MARGIN_DAYS, { message: 'marginDays deve estar entre 0 e 15.' })
  marginDays?: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Conta de origem. Exclusivo com creditCardId.' })
  @IsOptional()
  @ValidateIf((o: CreateFixedTransactionDto) => o.accountId !== null)
  @IsUUID('4', { message: 'accountId deve ser um UUID válido.' })
  accountId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Cartão de origem. Exclusivo com accountId.' })
  @IsOptional()
  @ValidateIf((o: CreateFixedTransactionDto) => o.creditCardId !== null)
  @IsUUID('4', { message: 'creditCardId deve ser um UUID válido.' })
  @Validate(ExactlyOneSourceConstraint)
  creditCardId?: string | null;

  @ApiProperty({ format: 'uuid', description: 'Categoria do lançamento. Obrigatória.' })
  @IsUUID('4', { message: 'categoryId deve ser um UUID válido.' })
  categoryId!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: MAX_DESCRIPTION_LENGTH, example: 'Aluguel' })
  @IsOptional()
  @ValidateIf((o: CreateFixedTransactionDto) => o.description !== null)
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string | null;
}

/**
 * PATCH semantics: a key that is absent stays as it is, and an explicit `null`
 * clears the optional relation. The exactly-one-source rule is re-checked by the
 * service against the **final** row, never against this patch alone.
 */
export class UpdateFixedTransactionDto {
  @ApiPropertyOptional({ enum: [...FIXED_TRANSACTION_TYPES] })
  @IsOptional()
  @IsIn(FIXED_TRANSACTION_TYPES, { message: 'type deve ser income ou expense.' })
  type?: FixedTransactionType;

  @ApiPropertyOptional({ example: 1250.9 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'value deve ser um número com no máximo 2 casas decimais.' })
  @Min(0.01, { message: 'value deve ser maior que zero.' })
  @Max(MAX_MONEY)
  value?: Money;

  @ApiPropertyOptional({ minimum: MIN_REFERENCE_DAY, maximum: MAX_REFERENCE_DAY })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'referenceDay deve ser um número inteiro.' })
  @Min(MIN_REFERENCE_DAY, { message: 'referenceDay deve estar entre 1 e 31.' })
  @Max(MAX_REFERENCE_DAY, { message: 'referenceDay deve estar entre 1 e 31.' })
  referenceDay?: number;

  @ApiPropertyOptional({ minimum: MIN_MARGIN_DAYS, maximum: MAX_MARGIN_DAYS })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'marginDays deve ser um número inteiro.' })
  @Min(MIN_MARGIN_DAYS, { message: 'marginDays deve estar entre 0 e 15.' })
  @Max(MAX_MARGIN_DAYS, { message: 'marginDays deve estar entre 0 e 15.' })
  marginDays?: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Envie null para limpar a conta de origem.' })
  @IsOptional()
  @ValidateIf((o: UpdateFixedTransactionDto) => o.accountId !== null)
  @IsUUID('4', { message: 'accountId deve ser um UUID válido.' })
  accountId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Envie null para limpar o cartão de origem.' })
  @IsOptional()
  @ValidateIf((o: UpdateFixedTransactionDto) => o.creditCardId !== null)
  @IsUUID('4', { message: 'creditCardId deve ser um UUID válido.' })
  creditCardId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'categoryId deve ser um UUID válido.' })
  categoryId?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: MAX_DESCRIPTION_LENGTH })
  @IsOptional()
  @ValidateIf((o: UpdateFixedTransactionDto) => o.description !== null)
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({ description: 'false arquiva o template; true o reativa.' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListFixedTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtra por templates ativos (true) ou arquivados (false).' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: [...FIXED_TRANSACTION_TYPES] })
  @IsOptional()
  @IsIn(FIXED_TRANSACTION_TYPES, { message: 'type deve ser income ou expense.' })
  type?: FixedTransactionType;
}

// ---------------------------------------------------------------------------
// Requests — occurrences
// ---------------------------------------------------------------------------

export class ListOccurrencesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1900, maximum: 9999, description: 'Ano de competência. Opcional.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'year deve ser um número inteiro.' })
  @Min(1900, { message: 'year deve estar entre 1900 e 9999.' })
  @Max(9999, { message: 'year deve estar entre 1900 e 9999.' })
  year?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 12, description: 'Mês de competência (1-12). Opcional.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'month deve ser um número inteiro.' })
  @Min(1, { message: 'month deve estar entre 1 e 12.' })
  @Max(12, { message: 'month deve estar entre 1 e 12.' })
  month?: number;

  @ApiPropertyOptional({ enum: [...OCCURRENCE_STATUSES] })
  @IsOptional()
  @IsIn(OCCURRENCE_STATUSES, { message: 'status deve ser pending, confirmed ou skipped.' })
  status?: OccurrenceStatus;

  @ApiPropertyOptional({ format: 'uuid', description: 'Restringe a um template específico.' })
  @IsOptional()
  @IsUUID('4', { message: 'fixedTransactionId deve ser um UUID válido.' })
  fixedTransactionId?: string;
}

export class ConfirmOccurrenceDto {
  @ApiPropertyOptional({
    example: '2026-04-15',
    description: 'Dia em que o dinheiro realmente se moveu. Padrão: o vencimento da ocorrência.',
  })
  @IsOptional()
  @IsString()
  @Matches(CIVIL_DATE_PATTERN, { message: `realDate ${CIVIL_DATE_MESSAGE}.` })
  realDate?: CivilDate;

  @ApiPropertyOptional({ example: 1310.55, description: 'Valor real deste período. Padrão: o valor do template.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'value deve ser um número com no máximo 2 casas decimais.' })
  @Min(0.01, { message: 'value deve ser maior que zero.' })
  @Max(MAX_MONEY)
  value?: Money;
}

// ---------------------------------------------------------------------------
// Responses (Swagger models; the runtime shape comes from the contracts package)
// ---------------------------------------------------------------------------

export class FixedTransactionResponseDto implements FixedTransaction {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: [...FIXED_TRANSACTION_TYPES] }) type!: FixedTransactionType;
  @ApiProperty({ example: 1250.9 }) value!: Money;
  @ApiProperty({ example: 10 }) referenceDay!: number;
  @ApiProperty({ example: 3 }) marginDays!: number;
  @ApiProperty({ format: 'uuid', nullable: true }) accountId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) creditCardId!: string | null;
  @ApiProperty({ format: 'uuid' }) categoryId!: string;
  @ApiProperty({ nullable: true, example: 'Aluguel' }) description!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ nullable: true, format: 'date-time' }) archivedAt!: IsoTimestamp | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: IsoTimestamp;
  @ApiProperty({ format: 'date-time' }) updatedAt!: IsoTimestamp;
}

export class OccurrenceCategoryDto implements Pick<Category, 'id' | 'name' | 'type'> {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Moradia' }) name!: string;
  @ApiProperty({ enum: [...CATEGORY_TYPES] }) type!: CategoryType;
}

export class OccurrenceTemplateRefDto implements Pick<FixedTransaction, 'id' | 'description' | 'referenceDay'> {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ nullable: true, example: 'Aluguel' }) description!: string | null;
  @ApiProperty({ example: 10 }) referenceDay!: number;
}

export class FixedTransactionOccurrenceResponseDto implements FixedTransactionOccurrence {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) fixedTransactionId!: string;
  @ApiProperty({ example: 2026 }) periodYear!: number;
  @ApiProperty({ example: 4, minimum: 1, maximum: 12 }) periodMonth!: number;
  @ApiProperty({ enum: [...OCCURRENCE_STATUSES] }) status!: OccurrenceStatus;
  @ApiProperty({ nullable: true, example: '2026-04-15' }) realDate!: CivilDate | null;
  @ApiProperty({ format: 'uuid', nullable: true }) transactionId!: string | null;
  @ApiProperty({ example: '2026-04-10' }) dueDate!: CivilDate;
  @ApiProperty({ enum: [...FIXED_TRANSACTION_TYPES] }) type!: FixedTransactionType;
  @ApiProperty({ example: 1250.9 }) value!: Money;
  @ApiProperty({ nullable: true, example: 'Aluguel' }) description!: string | null;
  @ApiProperty({ format: 'uuid' }) categoryId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) accountId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) creditCardId!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: IsoTimestamp;
  @ApiProperty({ format: 'date-time' }) updatedAt!: IsoTimestamp;
}

export class OccurrenceWithTemplateResponseDto
  extends FixedTransactionOccurrenceResponseDto
  implements OccurrenceWithTemplate
{
  @ApiProperty({ type: OccurrenceTemplateRefDto }) fixedTransaction!: OccurrenceTemplateRefDto;
  @ApiProperty({ type: OccurrenceCategoryDto, nullable: true }) category!: OccurrenceCategoryDto | null;
}

export class PaginatedFixedTransactionsDto implements PaginatedResponse<FixedTransaction> {
  @ApiProperty({ type: [FixedTransactionResponseDto] }) data!: FixedTransactionResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}

export class PaginatedOccurrencesDto implements PaginatedResponse<OccurrenceWithTemplate> {
  @ApiProperty({ type: [OccurrenceWithTemplateResponseDto] }) data!: OccurrenceWithTemplateResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}
