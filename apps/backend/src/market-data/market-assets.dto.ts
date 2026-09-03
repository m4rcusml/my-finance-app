import {
  type CreateMarketAssetRequest,
  MARKET_ASSET_TYPES,
  type MarketAsset,
  type MarketAssetType,
  type UpdateMarketAssetRequest,
} from '@finance/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { PaginationMetaDto } from '../common/pagination.dto';

/**
 * DTOs for the **manual asset catalogue**.
 *
 * There is no price, no quote and no history here: a row is nothing more than a
 * label the user typed once so their investments can point at it.
 */

const TYPE_MESSAGE = `type deve ser um destes valores: ${MARKET_ASSET_TYPES.join(', ')}.`;

/** `symbol` is stored uppercase so `petr4` and `PETR4` can never become two rows. */
const toUpperTrimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const toTrimmed = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class CreateMarketAssetDto implements CreateMarketAssetRequest {
  @ApiProperty({ example: 'PETR4', maxLength: 32, description: 'Código do ativo. Normalizado para maiúsculas.' })
  @Transform(toUpperTrimmed)
  @IsString({ message: 'symbol deve ser um texto.' })
  @IsNotEmpty({ message: 'symbol é obrigatório.' })
  @MaxLength(32, { message: 'symbol deve ter no máximo 32 caracteres.' })
  symbol!: string;

  @ApiProperty({ enum: MARKET_ASSET_TYPES, example: 'stock', description: 'Classe do ativo.' })
  @IsIn(MARKET_ASSET_TYPES, { message: TYPE_MESSAGE })
  type!: MarketAssetType;

  @ApiProperty({ example: 'B3', maxLength: 32, description: 'Bolsa ou mercado onde o ativo é negociado.' })
  @Transform(toTrimmed)
  @IsString({ message: 'exchange deve ser um texto.' })
  @IsNotEmpty({ message: 'exchange é obrigatório.' })
  @MaxLength(32, { message: 'exchange deve ter no máximo 32 caracteres.' })
  exchange!: string;

  @ApiPropertyOptional({
    example: 'Petrobras PN',
    nullable: true,
    maxLength: 120,
    description: 'Nome descritivo opcional. Envie null para limpar.',
  })
  @ValidateIf((o: CreateMarketAssetDto) => o.name !== undefined && o.name !== null)
  @Transform(toTrimmed)
  @IsString({ message: 'name deve ser um texto.' })
  @MaxLength(120, { message: 'name deve ter no máximo 120 caracteres.' })
  name?: string | null;
}

export class UpdateMarketAssetDto implements UpdateMarketAssetRequest {
  @ApiPropertyOptional({ example: 'PETR4', maxLength: 32, description: 'Código do ativo. Normalizado para maiúsculas.' })
  @ValidateIf((o: UpdateMarketAssetDto) => o.symbol !== undefined)
  @Transform(toUpperTrimmed)
  @IsString({ message: 'symbol deve ser um texto.' })
  @IsNotEmpty({ message: 'symbol não pode ser vazio.' })
  @MaxLength(32, { message: 'symbol deve ter no máximo 32 caracteres.' })
  symbol?: string;

  @ApiPropertyOptional({ enum: MARKET_ASSET_TYPES, example: 'stock' })
  @ValidateIf((o: UpdateMarketAssetDto) => o.type !== undefined)
  @IsIn(MARKET_ASSET_TYPES, { message: TYPE_MESSAGE })
  type?: MarketAssetType;

  @ApiPropertyOptional({ example: 'B3', maxLength: 32 })
  @ValidateIf((o: UpdateMarketAssetDto) => o.exchange !== undefined)
  @Transform(toTrimmed)
  @IsString({ message: 'exchange deve ser um texto.' })
  @IsNotEmpty({ message: 'exchange não pode ser vazio.' })
  @MaxLength(32, { message: 'exchange deve ter no máximo 32 caracteres.' })
  exchange?: string;

  @ApiPropertyOptional({ example: 'Petrobras PN', nullable: true, maxLength: 120 })
  @ValidateIf((o: UpdateMarketAssetDto) => o.name !== undefined && o.name !== null)
  @Transform(toTrimmed)
  @IsString({ message: 'name deve ser um texto.' })
  @MaxLength(120, { message: 'name deve ter no máximo 120 caracteres.' })
  name?: string | null;
}

/** Swagger model of a catalogue entry. Mirrors the `MarketAsset` contract exactly. */
export class MarketAssetResponseDto implements MarketAsset {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'PETR4' }) symbol!: string;
  @ApiProperty({ enum: MARKET_ASSET_TYPES, example: 'stock' }) type!: MarketAssetType;
  @ApiProperty({ example: 'B3' }) exchange!: string;
  @ApiProperty({ nullable: true, example: 'Petrobras PN' }) name!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class PaginatedMarketAssetsDto {
  @ApiProperty({ type: [MarketAssetResponseDto] }) data!: MarketAssetResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}
