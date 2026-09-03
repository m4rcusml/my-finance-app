import {
  CIVIL_DATE_PATTERN,
  type CreateInvestmentRequest,
  INVESTMENT_TYPES,
  type Investment,
  type InvestmentType,
  MARKET_ASSET_TYPES,
  type MarketAsset,
  type MarketAssetType,
  type PortfolioSummary,
  type UpdateInvestmentRequest,
} from '@finance/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Matches, MaxLength, Min, ValidateIf } from 'class-validator';
import { PaginationMetaDto, PaginationQueryDto } from '../common/pagination.dto';

/**
 * DTOs for the manual investment book.
 *
 * V1 records what was bought, when and for how much — cost basis only. There is
 * no price feed, so no DTO here carries a current value or a return.
 */

const TYPE_MESSAGE = `type deve ser um destes valores: ${INVESTMENT_TYPES.join(', ')}.`;
const DATE_MESSAGE = 'buyDate deve ser uma data civil no formato YYYY-MM-DD.';

const toTrimmed = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class CreateInvestmentDto implements CreateInvestmentRequest {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Ativo do catálogo manual do próprio usuário. Envie null para não vincular.',
  })
  @ValidateIf((o: CreateInvestmentDto) => o.marketAssetId !== undefined && o.marketAssetId !== null)
  @IsUUID(undefined, { message: 'marketAssetId deve ser um UUID válido.' })
  marketAssetId?: string | null;

  @ApiProperty({ example: 'XP Investimentos', maxLength: 120 })
  @Transform(toTrimmed)
  @IsString({ message: 'broker deve ser um texto.' })
  @IsNotEmpty({ message: 'broker é obrigatório.' })
  @MaxLength(120, { message: 'broker deve ter no máximo 120 caracteres.' })
  broker!: string;

  @ApiProperty({ enum: INVESTMENT_TYPES, example: 'stock' })
  @IsIn(INVESTMENT_TYPES, { message: TYPE_MESSAGE })
  type!: InvestmentType;

  @ApiProperty({ example: 100, description: 'Quantidade comprada, até 8 casas decimais. Deve ser maior que zero.' })
  @IsNumber({ maxDecimalPlaces: 8 }, { message: 'quantity deve ser um número com até 8 casas decimais.' })
  @IsPositive({ message: 'quantity deve ser maior que zero.' })
  quantity!: number;

  @ApiProperty({ example: 50.5, description: 'Preço unitário pago, 2 casas decimais.' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'buyPrice deve ser um número com até 2 casas decimais.' })
  @Min(0, { message: 'buyPrice não pode ser negativo.' })
  buyPrice!: number;

  @ApiProperty({ example: '2026-01-15', description: 'Data civil da compra (YYYY-MM-DD).' })
  @Matches(CIVIL_DATE_PATTERN, { message: DATE_MESSAGE })
  buyDate!: string;

  @ApiPropertyOptional({
    example: 5050,
    description: 'Opcional. Se omitido, é calculado como quantity × buyPrice arredondado em 2 casas.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'investedAmount deve ser um número com até 2 casas decimais.' })
  @Min(0, { message: 'investedAmount não pode ser negativo.' })
  investedAmount?: number;
}

export class UpdateInvestmentDto implements UpdateInvestmentRequest {
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Envie null para desvincular o ativo.' })
  @ValidateIf((o: UpdateInvestmentDto) => o.marketAssetId !== undefined && o.marketAssetId !== null)
  @IsUUID(undefined, { message: 'marketAssetId deve ser um UUID válido.' })
  marketAssetId?: string | null;

  @ApiPropertyOptional({ example: 'XP Investimentos', maxLength: 120 })
  @ValidateIf((o: UpdateInvestmentDto) => o.broker !== undefined)
  @Transform(toTrimmed)
  @IsString({ message: 'broker deve ser um texto.' })
  @IsNotEmpty({ message: 'broker não pode ser vazio.' })
  @MaxLength(120, { message: 'broker deve ter no máximo 120 caracteres.' })
  broker?: string;

  @ApiPropertyOptional({ enum: INVESTMENT_TYPES, example: 'stock' })
  @ValidateIf((o: UpdateInvestmentDto) => o.type !== undefined)
  @IsIn(INVESTMENT_TYPES, { message: TYPE_MESSAGE })
  type?: InvestmentType;

  @ApiPropertyOptional({ example: 100 })
  @ValidateIf((o: UpdateInvestmentDto) => o.quantity !== undefined)
  @IsNumber({ maxDecimalPlaces: 8 }, { message: 'quantity deve ser um número com até 8 casas decimais.' })
  @IsPositive({ message: 'quantity deve ser maior que zero.' })
  quantity?: number;

  @ApiPropertyOptional({ example: 50.5 })
  @ValidateIf((o: UpdateInvestmentDto) => o.buyPrice !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'buyPrice deve ser um número com até 2 casas decimais.' })
  @Min(0, { message: 'buyPrice não pode ser negativo.' })
  buyPrice?: number;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @ValidateIf((o: UpdateInvestmentDto) => o.buyDate !== undefined)
  @Matches(CIVIL_DATE_PATTERN, { message: DATE_MESSAGE })
  buyDate?: string;

  @ApiPropertyOptional({ example: 5050 })
  @ValidateIf((o: UpdateInvestmentDto) => o.investedAmount !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'investedAmount deve ser um número com até 2 casas decimais.' })
  @Min(0, { message: 'investedAmount não pode ser negativo.' })
  investedAmount?: number;
}

export class ListInvestmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: INVESTMENT_TYPES, description: 'Filtra por classe do investimento.' })
  @IsOptional()
  @IsIn(INVESTMENT_TYPES, { message: TYPE_MESSAGE })
  type?: InvestmentType;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtra pelos investimentos vinculados a este ativo.' })
  @IsOptional()
  @IsUUID(undefined, { message: 'marketAssetId deve ser um UUID válido.' })
  marketAssetId?: string;
}

/** Swagger model of the catalogue entry embedded in an investment. */
export class InvestmentMarketAssetDto implements MarketAsset {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'PETR4' }) symbol!: string;
  @ApiProperty({ enum: MARKET_ASSET_TYPES, example: 'stock' }) type!: MarketAssetType;
  @ApiProperty({ example: 'B3' }) exchange!: string;
  @ApiProperty({ nullable: true, example: 'Petrobras PN' }) name!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class InvestmentResponseDto implements Investment {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) marketAssetId!: string | null;
  @ApiProperty({ example: 'XP Investimentos' }) broker!: string;
  @ApiProperty({ enum: INVESTMENT_TYPES, example: 'stock' }) type!: InvestmentType;
  @ApiProperty({ example: 100 }) quantity!: number;
  @ApiProperty({ example: 50.5 }) buyPrice!: number;
  @ApiProperty({ example: 5050 }) investedAmount!: number;
  @ApiProperty({ example: '2026-01-15' }) buyDate!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: InvestmentMarketAssetDto, nullable: true }) marketAsset!: InvestmentMarketAssetDto | null;
}

export class PaginatedInvestmentsDto {
  @ApiProperty({ type: [InvestmentResponseDto] }) data!: InvestmentResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}

export class PortfolioSummaryByTypeDto {
  @ApiProperty({ enum: INVESTMENT_TYPES, example: 'stock' }) type!: InvestmentType;
  @ApiProperty({ example: 5050, description: 'Custo de aquisição somado. Não é valor de mercado.' })
  totalInvested!: number;
  @ApiProperty({ example: 3 }) positions!: number;
}

/** Cost basis only: V1 has no prices, so there is no current value, profit or return. */
export class PortfolioSummaryDto implements PortfolioSummary {
  @ApiProperty({ example: 12500, description: 'Total aportado (custo). Não representa valor de mercado.' })
  totalInvested!: number;
  @ApiProperty({ example: 7, description: 'Quantidade de posições registradas.' }) positions!: number;
  @ApiProperty({ type: [PortfolioSummaryByTypeDto] }) byType!: PortfolioSummaryByTypeDto[];
}
