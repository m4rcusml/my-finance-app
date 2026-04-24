import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export enum InvestmentType {
  STOCK = 'stock',
  FII = 'fii',
  CRYPTO = 'crypto',
  FIXED_INCOME = 'fixed_income',
  OTHER = 'other',
}

export class CreateInvestmentDto {
  @IsString()
  @IsNotEmpty()
  broker!: string;

  @IsEnum(InvestmentType)
  @IsNotEmpty()
  type!: InvestmentType;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Min(0)
  buyPrice!: number;

  @IsNumber()
  @Min(0)
  investedAmount!: number;

  @IsDateString()
  @IsNotEmpty()
  buyDate!: string;

  @IsUUID()
  @IsOptional()
  marketAssetId?: string;
}

export class UpdateInvestmentDto {
  @IsString()
  @IsOptional()
  broker?: string;

  @IsEnum(InvestmentType)
  @IsOptional()
  type?: InvestmentType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  buyPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  investedAmount?: number;

  @IsDateString()
  @IsOptional()
  buyDate?: string;

  @IsUUID()
  @IsOptional()
  marketAssetId?: string;
}
