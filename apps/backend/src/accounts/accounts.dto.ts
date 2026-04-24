import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum AccountType {
  CHECKING = 'checking',
  SAVINGS = 'savings',
  OTHER = 'other',
}

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  institution!: string;

  @IsEnum(AccountType)
  @IsNotEmpty()
  type!: AccountType;

  @IsNumber()
  @Min(0)
  initialBalance!: number;
}

export class UpdateAccountDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  institution?: string;

  @IsEnum(AccountType)
  @IsOptional()
  type?: AccountType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  initialBalance?: number;
}
