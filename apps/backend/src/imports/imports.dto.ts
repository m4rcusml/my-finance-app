import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class ParsedTransactionDto {
  @IsString()
  @IsOptional()
  externalId?: string;

  @IsString()
  @IsNotEmpty()
  date!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  value!: number;

  @IsString()
  @IsNotEmpty()
  type!: 'income' | 'expense';
}

export class PreviewImportDto {
  @IsString()
  @IsNotEmpty()
  origin!: string;

  @IsUUID()
  @IsOptional()
  accountId?: string;

  @IsUUID()
  @IsOptional()
  creditCardId?: string;
}

export class ConfirmImportDto {
  @IsString()
  @IsNotEmpty()
  origin!: string;

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @IsUUID()
  @IsOptional()
  accountId?: string;

  @IsUUID()
  @IsOptional()
  creditCardId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParsedTransactionDto)
  items!: ParsedTransactionDto[];
}
