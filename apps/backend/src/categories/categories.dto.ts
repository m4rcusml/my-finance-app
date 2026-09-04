import { CATEGORY_TYPES, type Category, type CategoryType, type PaginatedResponse } from '@finance/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { PaginationMetaDto, PaginationQueryDto } from '../common/pagination.dto';

/** Query strings never carry real booleans; implicit conversion is off globally. */
export function parseOptionalBoolean(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class CreateCategoryDto {
  @ApiPropertyOptional({ nullable: true, example: '#a78bfa' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color deve ser uma cor hexadecimal, como #a78bfa.' })
  color?: string | null;

  @ApiProperty({ example: 'Mercado', maxLength: 80 })
  @IsString()
  @IsNotEmpty({ message: 'name é obrigatório.' })
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: [...CATEGORY_TYPES], example: 'expense' })
  @IsIn(CATEGORY_TYPES, { message: `type deve ser um de: ${CATEGORY_TYPES.join(', ')}.` })
  type!: CategoryType;
}

/** PATCH: chave ausente permanece inalterada; `null` não é aceito em campo obrigatório. */
export class UpdateCategoryDto {
  @ApiPropertyOptional({ nullable: true, example: '#a78bfa' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color deve ser uma cor hexadecimal, como #a78bfa.' })
  color?: string | null;

  @ApiPropertyOptional({ example: 'Supermercado', maxLength: 80 })
  @ValidateIf((o: UpdateCategoryDto) => o.name !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'name não pode ser vazio.' })
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ enum: [...CATEGORY_TYPES], example: 'both' })
  @ValidateIf((o: UpdateCategoryDto) => o.type !== undefined)
  @IsIn(CATEGORY_TYPES, { message: `type deve ser um de: ${CATEGORY_TYPES.join(', ')}.` })
  type?: CategoryType;
}

export class ListCategoriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['active', 'archived', 'all'] })
  @IsOptional()
  @IsIn(['active', 'archived', 'all'])
  status?: 'active' | 'archived' | 'all';

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({ type: Boolean, default: false, description: 'Inclui categorias arquivadas.' })
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean({ message: 'includeArchived deve ser true ou false.' })
  includeArchived?: boolean;

  @ApiPropertyOptional({ enum: [...CATEGORY_TYPES], description: 'Filtra por tipo exato.' })
  @IsOptional()
  @IsIn(CATEGORY_TYPES, { message: `type deve ser um de: ${CATEGORY_TYPES.join(', ')}.` })
  type?: CategoryType;
}

/** Swagger model. `implements Category` makes any drift a compile error. */
export class CategoryResponseDto implements Category {
  @ApiPropertyOptional({ nullable: true, example: '#a78bfa' }) color?: string | null;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Mercado' }) name!: string;
  @ApiProperty({ enum: [...CATEGORY_TYPES], example: 'expense' }) type!: CategoryType;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiProperty({ type: String, nullable: true, example: null }) archivedAt!: string | null;
  @ApiProperty({ example: '2026-01-15T12:00:00.000Z' }) createdAt!: string;
  @ApiProperty({ example: '2026-01-15T12:00:00.000Z' }) updatedAt!: string;
}

export class PaginatedCategoriesDto implements PaginatedResponse<Category> {
  @ApiProperty({ type: [CategoryResponseDto] }) data!: CategoryResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}
