import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum FixedTransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export class CreateFixedTransactionDto {
  @IsEnum(FixedTransactionType)
  @IsNotEmpty()
  type!: FixedTransactionType;

  @IsNumber()
  @Min(0)
  value!: number;

  @IsInt()
  @Min(1)
  @Max(31)
  referenceDay!: number;

  @IsInt()
  @Min(0)
  @Max(15)
  marginDays!: number;

  @IsUUID()
  @IsNotEmpty()
  accountId!: string;

  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateFixedTransactionDto {
  @IsEnum(FixedTransactionType)
  @IsOptional()
  type?: FixedTransactionType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  value?: number;

  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  referenceDay?: number;

  @IsInt()
  @Min(0)
  @Max(15)
  @IsOptional()
  marginDays?: number;

  @IsUUID()
  @IsOptional()
  accountId?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ConfirmOccurrenceDto {
  @IsString()
  @IsOptional()
  realDate?: string;
}
