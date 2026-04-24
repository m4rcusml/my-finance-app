import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum MarketAssetType {
  STOCK = 'stock',
  FII = 'fii',
  CRYPTO = 'crypto',
  FIXED_INCOME = 'fixed_income',
  OTHER = 'other',
}

export class CreateMarketAssetDto {
  @IsString()
  @IsNotEmpty()
  symbol!: string;

  @IsEnum(MarketAssetType)
  @IsNotEmpty()
  type!: MarketAssetType;

  @IsString()
  @IsNotEmpty()
  exchange!: string;

  @IsString()
  @IsOptional()
  name?: string;
}

export class UpdateMarketAssetDto {
  @IsString()
  @IsOptional()
  symbol?: string;

  @IsEnum(MarketAssetType)
  @IsOptional()
  type?: MarketAssetType;

  @IsString()
  @IsOptional()
  exchange?: string;

  @IsString()
  @IsOptional()
  name?: string;
}
