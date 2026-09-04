import {
  type Account,
  type Category,
  CIVIL_DATE_PATTERN,
  type CivilDate,
  type CreateTransactionRequest,
  type CreditCard,
  type ExpenseProjection,
  isCivilDate,
  type ListTransactionsQuery,
  type MonthlyNet,
  type PaginatedResponse,
  TRANSACTION_SOURCES,
  TRANSACTION_TYPES,
  type Transaction,
  type TransactionSource,
  type TransactionSummary,
  type TransactionType,
  type TransactionWithRelations,
  type UpdateTransactionRequest,
  type YearMonth,
} from '@finance/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
  registerDecorator,
  ValidateIf,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { PaginationMetaDto, PaginationQueryDto } from '../common/pagination.dto';

/**
 * Re-exported so other modules keep one import site for the transaction unions.
 * These are the contracts' string-literal unions, never TypeScript `enum`s.
 */
export type { TransactionSource, TransactionType };

/**
 * `numeric(15,2)` tops out just below 1e13. Rejecting bigger numbers here turns
 * what would be a Postgres overflow (a 500) into a field-level 400.
 */
const MAX_MONEY = 9_999_999_999_999.99;
const MAX_DESCRIPTION = 500;

/** Default and hard cap for the expense projection window, in whole months. */
export const DEFAULT_PROJECTION_MONTHS = 3;
export const MAX_PROJECTION_MONTHS = 12;

/**
 * Calendar validity on top of the `YYYY-MM-DD` shape.
 *
 * `@Matches(CIVIL_DATE_PATTERN)` alone happily accepts `2026-02-31`, which then
 * explodes as a `RangeError` inside `fromCivilDate` — a 500 for what is plainly
 * a bad request.
 */
export function IsCivilDateString(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isCivilDateString',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isCivilDate(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} deve ser um dia válido do calendário (YYYY-MM-DD).`;
        },
      },
    });
  };
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export class CreateTransactionDto implements CreateTransactionRequest {
  @ApiProperty({ enum: [...TRANSACTION_TYPES], example: 'expense' })
  @IsIn(TRANSACTION_TYPES, { message: 'type deve ser income ou expense.' })
  type!: TransactionType;

  @ApiProperty({
    example: 129.9,
    description: 'Sempre positivo: o sinal do lançamento vem de `type`.',
    minimum: 0.01,
    maximum: MAX_MONEY,
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'value deve ser um número com até 2 casas decimais.' })
  @Min(0.01, { message: 'value deve ser maior que zero.' })
  @Max(MAX_MONEY, { message: 'value excede o valor máximo permitido.' })
  value!: number;

  @ApiProperty({ example: '2026-04-01', description: 'Data civil YYYY-MM-DD, sem hora e sem fuso.' })
  @Matches(CIVIL_DATE_PATTERN, { message: 'date deve estar no formato YYYY-MM-DD.' })
  @IsCivilDateString()
  date!: CivilDate;

  @ApiPropertyOptional({
    nullable: true,
    format: 'uuid',
    description: 'Conta de origem. Informe exatamente um entre accountId e creditCardId.',
  })
  @IsOptional()
  @ValidateIf((o: CreateTransactionDto) => o.accountId !== null)
  @IsUUID('all', { message: 'accountId deve ser um UUID válido.' })
  accountId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    format: 'uuid',
    description: 'Cartão de origem. Informe exatamente um entre accountId e creditCardId.',
  })
  @IsOptional()
  @ValidateIf((o: CreateTransactionDto) => o.creditCardId !== null)
  @IsUUID('all', { message: 'creditCardId deve ser um UUID válido.' })
  creditCardId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    format: 'uuid',
    description: 'Categoria. `null` deixa o lançamento sem categoria.',
  })
  @IsOptional()
  @ValidateIf((o: CreateTransactionDto) => o.categoryId !== null)
  @IsUUID('all', { message: 'categoryId deve ser um UUID válido.' })
  categoryId?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: MAX_DESCRIPTION, example: 'Mercado da esquina' })
  @IsOptional()
  @ValidateIf((o: CreateTransactionDto) => o.description !== null)
  @IsString({ message: 'description deve ser um texto.' })
  @MaxLength(MAX_DESCRIPTION, { message: `description deve ter no máximo ${MAX_DESCRIPTION} caracteres.` })
  description?: string | null;
}

/**
 * PATCH: uma chave ausente não é tocada, `null` limpa a relação.
 *
 * O serviço monta o estado FINAL do lançamento e só então valida a regra de
 * origem única — validar apenas o patch é o que permitia terminar com conta e
 * cartão preenchidos ao mesmo tempo.
 */
export class UpdateTransactionDto implements UpdateTransactionRequest {
  @ApiPropertyOptional({ enum: [...TRANSACTION_TYPES] })
  @IsOptional()
  @IsIn(TRANSACTION_TYPES, { message: 'type deve ser income ou expense.' })
  type?: TransactionType;

  @ApiPropertyOptional({ example: 129.9, minimum: 0.01, maximum: MAX_MONEY })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'value deve ser um número com até 2 casas decimais.' })
  @Min(0.01, { message: 'value deve ser maior que zero.' })
  @Max(MAX_MONEY, { message: 'value excede o valor máximo permitido.' })
  value?: number;

  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsOptional()
  @Matches(CIVIL_DATE_PATTERN, { message: 'date deve estar no formato YYYY-MM-DD.' })
  @IsCivilDateString()
  date?: CivilDate;

  @ApiPropertyOptional({ nullable: true, format: 'uuid', description: '`null` remove o vínculo com a conta.' })
  @IsOptional()
  @ValidateIf((o: UpdateTransactionDto) => o.accountId !== null)
  @IsUUID('all', { message: 'accountId deve ser um UUID válido.' })
  accountId?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid', description: '`null` remove o vínculo com o cartão.' })
  @IsOptional()
  @ValidateIf((o: UpdateTransactionDto) => o.creditCardId !== null)
  @IsUUID('all', { message: 'creditCardId deve ser um UUID válido.' })
  creditCardId?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid', description: '`null` deixa o lançamento sem categoria.' })
  @IsOptional()
  @ValidateIf((o: UpdateTransactionDto) => o.categoryId !== null)
  @IsUUID('all', { message: 'categoryId deve ser um UUID válido.' })
  categoryId?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: MAX_DESCRIPTION })
  @IsOptional()
  @ValidateIf((o: UpdateTransactionDto) => o.description !== null)
  @IsString({ message: 'description deve ser um texto.' })
  @MaxLength(MAX_DESCRIPTION, { message: `description deve ter no máximo ${MAX_DESCRIPTION} caracteres.` })
  description?: string | null;
}

/** Filtros de `GET /transactions` e de `GET /transactions/uncategorized`. */
export class ListTransactionsQueryDto extends PaginationQueryDto implements ListTransactionsQuery {
  @ApiPropertyOptional({ maxLength: MAX_DESCRIPTION, description: 'Busca por descrição, antes da paginação.' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION)
  search?: string;

  @ApiPropertyOptional({ enum: [...TRANSACTION_TYPES] })
  @IsOptional()
  @IsIn(TRANSACTION_TYPES, { message: 'type deve ser income ou expense.' })
  type?: TransactionType;

  @ApiPropertyOptional({ enum: [...TRANSACTION_SOURCES], description: 'Como o lançamento foi criado.' })
  @IsOptional()
  @IsIn(TRANSACTION_SOURCES, { message: 'source deve ser manual, imported ou fixed.' })
  source?: TransactionSource;

  @ApiPropertyOptional({ example: '2026-04-01', description: 'Início do intervalo, inclusivo.' })
  @IsOptional()
  @Matches(CIVIL_DATE_PATTERN, { message: 'fromDate deve estar no formato YYYY-MM-DD.' })
  @IsCivilDateString()
  fromDate?: CivilDate;

  @ApiPropertyOptional({ example: '2026-04-30', description: 'Fim do intervalo, inclusivo — o dia inteiro entra.' })
  @IsOptional()
  @Matches(CIVIL_DATE_PATTERN, { message: 'toDate deve estar no formato YYYY-MM-DD.' })
  @IsCivilDateString()
  toDate?: CivilDate;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'accountId deve ser um UUID válido.' })
  accountId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'creditCardId deve ser um UUID válido.' })
  creditCardId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'categoryId deve ser um UUID válido.' })
  categoryId?: string;
}

/** `from` e `to` são obrigatórios: sem janela não existe resumo. */
export class TransactionSummaryQueryDto {
  @ApiProperty({ example: '2026-04-01', description: 'Início do intervalo, inclusivo.' })
  @Matches(CIVIL_DATE_PATTERN, { message: 'from é obrigatório no formato YYYY-MM-DD.' })
  @IsCivilDateString()
  from!: CivilDate;

  @ApiProperty({ example: '2026-04-30', description: 'Fim do intervalo, inclusivo.' })
  @Matches(CIVIL_DATE_PATTERN, { message: 'to é obrigatório no formato YYYY-MM-DD.' })
  @IsCivilDateString()
  to!: CivilDate;
}

export class ExpenseProjectionQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PROJECTION_MONTHS,
    default: DEFAULT_PROJECTION_MONTHS,
    description: 'Quantidade de meses completos considerados. O mês corrente nunca entra.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'months deve ser um número inteiro.' })
  @Min(1, { message: 'months deve ser no mínimo 1.' })
  @Max(MAX_PROJECTION_MONTHS, { message: `months deve ser no máximo ${MAX_PROJECTION_MONTHS}.` })
  months?: number;
}

// ---------------------------------------------------------------------------
// Responses (Swagger models — the runtime shape comes from the contracts package)
// ---------------------------------------------------------------------------

export class CategoryRefDto implements Pick<Category, 'id' | 'name' | 'type'> {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Alimentação' }) name!: string;
  @ApiProperty({ enum: ['income', 'expense', 'both'] }) type!: Category['type'];
}

export class AccountRefDto implements Pick<Account, 'id' | 'name'> {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Conta corrente' }) name!: string;
}

export class CreditCardRefDto implements Pick<CreditCard, 'id' | 'name'> {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Cartão Inter' }) name!: string;
}

export class TransactionDto implements Transaction {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: [...TRANSACTION_TYPES] }) type!: TransactionType;
  @ApiProperty({ example: 129.9 }) value!: number;
  @ApiProperty({ example: '2026-04-01' }) date!: CivilDate;
  @ApiProperty({ nullable: true, format: 'uuid' }) accountId!: string | null;
  @ApiProperty({ nullable: true, format: 'uuid' }) creditCardId!: string | null;
  @ApiProperty({ nullable: true, format: 'uuid' }) categoryId!: string | null;
  @ApiProperty({ nullable: true, example: 'Mercado da esquina' }) description!: string | null;
  @ApiProperty({ enum: [...TRANSACTION_SOURCES] }) source!: TransactionSource;
  @ApiProperty({ nullable: true, description: 'Id estável da linha importada.' }) externalId!: string | null;
  @ApiProperty({ example: '2026-04-01T12:00:00.000Z' }) createdAt!: string;
  @ApiProperty({ example: '2026-04-01T12:00:00.000Z' }) updatedAt!: string;
}

export class TransactionWithRelationsDto extends TransactionDto implements TransactionWithRelations {
  @ApiProperty({ type: CategoryRefDto, nullable: true }) category!: CategoryRefDto | null;
  @ApiProperty({ type: AccountRefDto, nullable: true }) account!: AccountRefDto | null;
  @ApiProperty({ type: CreditCardRefDto, nullable: true }) creditCard!: CreditCardRefDto | null;
}

export class PaginatedTransactionsDto implements PaginatedResponse<TransactionWithRelations> {
  @ApiProperty({ type: [TransactionWithRelationsDto] }) data!: TransactionWithRelationsDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}

export class TransactionSummaryDto implements TransactionSummary {
  @ApiProperty({ example: 5000 }) income!: number;
  @ApiProperty({ example: 3500 }) expense!: number;
  @ApiProperty({ example: 1500, description: 'income - expense.' }) net!: number;
  @ApiProperty({ example: 42 }) count!: number;
  @ApiProperty({ example: '2026-04-01' }) from!: CivilDate;
  @ApiProperty({ example: '2026-04-30' }) to!: CivilDate;
}

export class MonthlyNetDto implements MonthlyNet {
  @ApiProperty({ example: '2026-03', description: 'YYYY-MM.' }) month!: YearMonth;
  @ApiProperty({ example: 5000 }) income!: number;
  @ApiProperty({ example: 3500 }) expense!: number;
  @ApiProperty({ example: 1500 }) net!: number;
}

export class ProjectionWindowDto {
  @ApiProperty({ example: '2026-01-01' }) from!: CivilDate;
  @ApiProperty({ example: '2026-03-31' }) to!: CivilDate;
}

export class ExpenseProjectionDto implements ExpenseProjection {
  @ApiProperty({ example: 3000, description: 'Média de despesa dos meses completos da janela.' })
  projectedMonthlyExpense!: number;

  @ApiProperty({ example: 3, description: 'Meses completos considerados; meses sem movimento contam como zero.' })
  basedOnMonths!: number;

  @ApiProperty({ type: ProjectionWindowDto }) window!: ProjectionWindowDto;
  @ApiProperty({ type: [MonthlyNetDto] }) months!: MonthlyNetDto[];
}
