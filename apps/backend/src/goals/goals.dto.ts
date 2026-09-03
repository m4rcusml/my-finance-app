import {
  CIVIL_DATE_PATTERN,
  type CreateGoalRequest,
  GOAL_TYPES,
  type Goal,
  type GoalType,
  type UpdateGoalRequest,
} from '@finance/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationMetaDto } from '../common/pagination.dto';

/**
 * DTOs for goals with **manual** progress.
 *
 * `currentAmount` is always a number the user typed. V1 never derives it from
 * transactions, and `relatedCategoryId` / `relatedAccountId` are labels only —
 * they never move the needle.
 */

const TYPE_MESSAGE = `type deve ser um destes valores: ${GOAL_TYPES.join(', ')}.`;
const DEADLINE_MESSAGE = 'deadline deve ser uma data civil no formato YYYY-MM-DD.';

const toTrimmed = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class CreateGoalDto implements CreateGoalRequest {
  @ApiProperty({ example: 'Reserva de emergência', maxLength: 120 })
  @Transform(toTrimmed)
  @IsString({ message: 'name deve ser um texto.' })
  @IsNotEmpty({ message: 'name é obrigatório.' })
  @MaxLength(120, { message: 'name deve ter no máximo 120 caracteres.' })
  name!: string;

  @ApiProperty({ enum: GOAL_TYPES, example: 'saving' })
  @IsIn(GOAL_TYPES, { message: TYPE_MESSAGE })
  type!: GoalType;

  @ApiProperty({ example: 15000, description: 'Valor alvo. Deve ser maior que zero.' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'targetAmount deve ser um número com até 2 casas decimais.' })
  @IsPositive({ message: 'targetAmount deve ser maior que zero.' })
  targetAmount!: number;

  @ApiPropertyOptional({ example: 5000, default: 0, description: 'Progresso informado manualmente. Padrão 0.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'currentAmount deve ser um número com até 2 casas decimais.' })
  @Min(0, { message: 'currentAmount não pode ser negativo.' })
  currentAmount?: number;

  @ApiPropertyOptional({
    example: '2026-12-31',
    nullable: true,
    description: 'Data civil alvo. Envie null para limpar.',
  })
  @ValidateIf((o: CreateGoalDto) => o.deadline !== undefined && o.deadline !== null)
  @Matches(CIVIL_DATE_PATTERN, { message: DEADLINE_MESSAGE })
  deadline?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Categoria apenas como rótulo: na V1 não influencia o progresso.',
  })
  @ValidateIf((o: CreateGoalDto) => o.relatedCategoryId !== undefined && o.relatedCategoryId !== null)
  @IsUUID(undefined, { message: 'relatedCategoryId deve ser um UUID válido.' })
  relatedCategoryId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Conta apenas como rótulo: na V1 não influencia o progresso.',
  })
  @ValidateIf((o: CreateGoalDto) => o.relatedAccountId !== undefined && o.relatedAccountId !== null)
  @IsUUID(undefined, { message: 'relatedAccountId deve ser um UUID válido.' })
  relatedAccountId?: string | null;
}

export class UpdateGoalDto implements UpdateGoalRequest {
  @ApiPropertyOptional({ example: 'Reserva de emergência', maxLength: 120 })
  @ValidateIf((o: UpdateGoalDto) => o.name !== undefined)
  @Transform(toTrimmed)
  @IsString({ message: 'name deve ser um texto.' })
  @IsNotEmpty({ message: 'name não pode ser vazio.' })
  @MaxLength(120, { message: 'name deve ter no máximo 120 caracteres.' })
  name?: string;

  @ApiPropertyOptional({ enum: GOAL_TYPES, example: 'saving' })
  @ValidateIf((o: UpdateGoalDto) => o.type !== undefined)
  @IsIn(GOAL_TYPES, { message: TYPE_MESSAGE })
  type?: GoalType;

  @ApiPropertyOptional({ example: 15000 })
  @ValidateIf((o: UpdateGoalDto) => o.targetAmount !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'targetAmount deve ser um número com até 2 casas decimais.' })
  @IsPositive({ message: 'targetAmount deve ser maior que zero.' })
  targetAmount?: number;

  @ApiPropertyOptional({ example: 5000 })
  @ValidateIf((o: UpdateGoalDto) => o.currentAmount !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'currentAmount deve ser um número com até 2 casas decimais.' })
  @Min(0, { message: 'currentAmount não pode ser negativo.' })
  currentAmount?: number;

  @ApiPropertyOptional({ example: '2026-12-31', nullable: true, description: 'Envie null para remover o prazo.' })
  @ValidateIf((o: UpdateGoalDto) => o.deadline !== undefined && o.deadline !== null)
  @Matches(CIVIL_DATE_PATTERN, { message: DEADLINE_MESSAGE })
  deadline?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Envie null para desvincular a categoria.' })
  @ValidateIf((o: UpdateGoalDto) => o.relatedCategoryId !== undefined && o.relatedCategoryId !== null)
  @IsUUID(undefined, { message: 'relatedCategoryId deve ser um UUID válido.' })
  relatedCategoryId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Envie null para desvincular a conta.' })
  @ValidateIf((o: UpdateGoalDto) => o.relatedAccountId !== undefined && o.relatedAccountId !== null)
  @IsUUID(undefined, { message: 'relatedAccountId deve ser um UUID válido.' })
  relatedAccountId?: string | null;
}

/** Body of the convenience route `PATCH /goals/:id/progress`. */
export class UpdateGoalProgressDto {
  @ApiProperty({ example: 5000, description: 'Novo valor acumulado, informado manualmente.' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'currentAmount deve ser um número com até 2 casas decimais.' })
  @Min(0, { message: 'currentAmount não pode ser negativo.' })
  currentAmount!: number;
}

export class GoalResponseDto implements Goal {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Reserva de emergência' }) name!: string;
  @ApiProperty({ enum: GOAL_TYPES, example: 'saving' }) type!: GoalType;
  @ApiProperty({ example: 15000 }) targetAmount!: number;
  @ApiProperty({ example: 5000, description: 'Sempre informado pelo usuário.' }) currentAmount!: number;
  @ApiProperty({ example: '2026-12-31', nullable: true }) deadline!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) relatedCategoryId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) relatedAccountId!: string | null;
  @ApiProperty({
    example: 0.3333,
    minimum: 0,
    maximum: 1,
    description: 'currentAmount / targetAmount, limitado a [0, 1].',
  })
  progress!: number;
  @ApiProperty({ enum: ['manual'], example: 'manual', description: 'Sempre manual na V1.' })
  progressSource!: 'manual';
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class PaginatedGoalsDto {
  @ApiProperty({ type: [GoalResponseDto] }) data!: GoalResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}

/** Read-only view used by `GET /goals/:id/progress`. */
export class GoalProgressDto {
  @ApiProperty({ format: 'uuid' }) goalId!: string;
  @ApiProperty({ example: 'Reserva de emergência' }) name!: string;
  @ApiProperty({ example: 15000 }) targetAmount!: number;
  @ApiProperty({ example: 5000 }) currentAmount!: number;
  @ApiProperty({ example: 0.3333 }) progress!: number;
  @ApiProperty({ example: 33.33, description: 'progress × 100, arredondado em 2 casas.' }) percentage!: number;
  @ApiProperty({ example: '2026-12-31', nullable: true }) deadline!: string | null;
  @ApiProperty({ enum: ['manual'], example: 'manual' }) progressSource!: 'manual';
}
