import type { BillingCycle, CreditCard, PaginatedResponse } from '@finance/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
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

/** Upper bound of `numeric(15, 2)`. */
const MONEY_MAX = 9_999_999_999_999.99;

/** Query strings never carry real booleans; implicit conversion is off globally. */
export function parseOptionalBoolean(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class CreateCreditCardDto {
  @ApiProperty({ example: 'Cartão Inter Gold', maxLength: 120 })
  @IsString()
  @IsNotEmpty({ message: 'name é obrigatório.' })
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'Banco Inter', maxLength: 120 })
  @IsString()
  @IsNotEmpty({ message: 'institution é obrigatório.' })
  @MaxLength(120)
  institution!: string;

  @ApiProperty({ example: 5000, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'limitTotal deve ter no máximo 2 casas decimais.' })
  @Min(0, { message: 'limitTotal não pode ser negativo.' })
  @Max(MONEY_MAX)
  limitTotal!: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 1,
    maximum: 31,
    example: 10,
    description: 'Dia de fechamento da fatura. `null` alinha o ciclo ao mês civil.',
  })
  @ValidateIf((o: CreateCreditCardDto) => o.closingDay !== undefined && o.closingDay !== null)
  @IsInt({ message: 'closingDay deve ser um número inteiro entre 1 e 31.' })
  @Min(1, { message: 'closingDay deve estar entre 1 e 31.' })
  @Max(31, { message: 'closingDay deve estar entre 1 e 31.' })
  closingDay?: number | null;
}

/**
 * PATCH: chave ausente permanece inalterada; `closingDay: null` **limpa** o dia
 * de fechamento (o ciclo passa a ser o mês civil). Os demais campos são
 * obrigatórios e por isso rejeitam `null`.
 */
export class UpdateCreditCardDto {
  @ApiPropertyOptional({ example: 'Cartão Nubank', maxLength: 120 })
  @ValidateIf((o: UpdateCreditCardDto) => o.name !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'name não pode ser vazio.' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Nubank', maxLength: 120 })
  @ValidateIf((o: UpdateCreditCardDto) => o.institution !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'institution não pode ser vazio.' })
  @MaxLength(120)
  institution?: string;

  @ApiPropertyOptional({ example: 8000, minimum: 0 })
  @ValidateIf((o: UpdateCreditCardDto) => o.limitTotal !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'limitTotal deve ter no máximo 2 casas decimais.' })
  @Min(0, { message: 'limitTotal não pode ser negativo.' })
  @Max(MONEY_MAX)
  limitTotal?: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 1,
    maximum: 31,
    example: 15,
    description: 'Envie `null` para remover o dia de fechamento e usar o mês civil.',
  })
  @ValidateIf((o: UpdateCreditCardDto) => o.closingDay !== undefined && o.closingDay !== null)
  @IsInt({ message: 'closingDay deve ser um número inteiro entre 1 e 31.' })
  @Min(1, { message: 'closingDay deve estar entre 1 e 31.' })
  @Max(31, { message: 'closingDay deve estar entre 1 e 31.' })
  closingDay?: number | null;
}

export class ListCreditCardsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ type: Boolean, default: false, description: 'Inclui cartões arquivados.' })
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean({ message: 'includeArchived deve ser true ou false.' })
  includeArchived?: boolean;
}

export class BillingCycleDto implements BillingCycle {
  @ApiProperty({ example: '2026-03-11', description: 'Primeiro dia do ciclo, inclusivo.' })
  start!: string;

  @ApiProperty({ example: '2026-04-10', description: 'Último dia do ciclo, inclusivo.' })
  end!: string;
}

/** Swagger model. `implements CreditCard` makes any drift a compile error. */
export class CreditCardResponseDto implements CreditCard {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Cartão Inter Gold' }) name!: string;
  @ApiProperty({ example: 'Banco Inter' }) institution!: string;
  @ApiProperty({ example: 5000 }) limitTotal!: number;
  @ApiProperty({ type: Number, nullable: true, example: 10 }) closingDay!: number | null;

  @ApiProperty({ example: 1250.4, description: 'Somente as despesas do ciclo aberto atual.' })
  cycleUsedAmount!: number;

  @ApiProperty({ example: 3749.6, description: '`limitTotal - cycleUsedAmount`; pode ficar negativo.' })
  availableAmount!: number;

  @ApiProperty({ type: BillingCycleDto }) currentCycle!: BillingCycleDto;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiProperty({ type: String, nullable: true, example: null }) archivedAt!: string | null;
  @ApiProperty({ example: '2026-01-15T12:00:00.000Z' }) createdAt!: string;
  @ApiProperty({ example: '2026-01-15T12:00:00.000Z' }) updatedAt!: string;
}

export class PaginatedCreditCardsDto implements PaginatedResponse<CreditCard> {
  @ApiProperty({ type: [CreditCardResponseDto] }) data!: CreditCardResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}
