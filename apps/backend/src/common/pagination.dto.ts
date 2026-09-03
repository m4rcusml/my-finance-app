import {
  buildPaginatedResponse,
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type PaginatedResponse,
  type PaginationMeta,
} from '@finance/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export type { PaginatedResponse, PaginationMeta };
export { buildPaginatedResponse, buildPaginationMeta, DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: DEFAULT_PAGE, description: 'Página, 1-based.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
    description: `Itens por página (máximo ${MAX_PAGE_SIZE}).`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number = DEFAULT_PAGE_SIZE;
}

/** Swagger model for the meta block; the runtime shape comes from the contracts package. */
export class PaginationMetaDto implements PaginationMeta {
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ example: 137 }) totalItems!: number;
  @ApiProperty({ example: 7 }) totalPages!: number;
  @ApiProperty({ example: false }) hasPreviousPage!: boolean;
  @ApiProperty({ example: true }) hasNextPage!: boolean;
}

/** Normalises possibly-absent query values into the clamped page/limit actually used. */
export function resolvePagination(query?: { page?: number; limit?: number }): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, Math.trunc(query?.page ?? DEFAULT_PAGE));
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(query?.limit ?? DEFAULT_PAGE_SIZE)));
  return { page, limit, skip: (page - 1) * limit };
}
