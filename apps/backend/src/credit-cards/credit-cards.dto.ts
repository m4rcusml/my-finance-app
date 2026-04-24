import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCreditCardDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  institution!: string;

  @IsNumber()
  @Min(0)
  limitTotal!: number;

  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  closingDay?: number;
}

export class UpdateCreditCardDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  institution?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  limitTotal?: number;

  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  closingDay?: number;

  @IsOptional()
  isActive?: boolean;
}
