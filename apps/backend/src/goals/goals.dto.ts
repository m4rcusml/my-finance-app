import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export enum GoalType {
  SAVINGS = 'savings',
  SPENDING_LIMIT = 'spending_limit',
  PURCHASE = 'purchase',
}

export class CreateGoalDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(GoalType)
  @IsNotEmpty()
  type!: GoalType;

  @IsNumber()
  @Min(0.01)
  targetAmount!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  currentAmount?: number;

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsUUID()
  @IsOptional()
  relatedAccountId?: string;

  @IsUUID()
  @IsOptional()
  relatedCategoryId?: string;
}

export class UpdateGoalDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(GoalType)
  @IsOptional()
  type?: GoalType;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  targetAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  currentAmount?: number;

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsUUID()
  @IsOptional()
  relatedAccountId?: string;

  @IsUUID()
  @IsOptional()
  relatedCategoryId?: string;
}
