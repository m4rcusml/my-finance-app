import { buildPaginatedResponse, type Category, type CategoryType, type PaginatedResponse } from '@finance/contracts';
import { ConflictException, Injectable } from '@nestjs/common';
import { assertOwned } from '../common/ownership';
import { resolvePagination } from '../common/pagination.dto';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCategoryDto, ListCategoriesQueryDto, UpdateCategoryDto } from './categories.dto';

type CategoryRow = {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  color?: string | null;
  isActive: boolean;
  archivedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const NOT_FOUND = 'Categoria';

function toIso(value: Date | string): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  return value === null || value === undefined ? null : toIso(value);
}

/** `@@unique([userId, name, type])` violated. Mapped to a readable 409. */
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}

function duplicateMessage(name: string, type: CategoryType): string {
  return `Você já tem uma categoria "${name}" do tipo "${type}".`;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async findAll(userId: string, query: ListCategoriesQueryDto = {}): Promise<PaginatedResponse<Category>> {
    const { page, limit, skip } = resolvePagination(query);
    const where: Prisma.CategoryWhereInput = {
      userId,
      ...(query.status === 'archived'
        ? { isActive: false }
        : query.status === 'all' || (!query.status && query.includeArchived === true)
          ? {}
          : { isActive: true }),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search?.trim() ? { name: { contains: query.search.trim(), mode: 'insensitive' } } : {}),
    };

    const [rows, totalItems] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.category.count({ where }),
    ]);

    return buildPaginatedResponse(
      rows.map((row) => this.toResource(row as CategoryRow)),
      totalItems,
      page,
      limit,
    );
  }

  async findOne(userId: string, categoryId: string): Promise<Category> {
    const row = assertOwned(await this.prisma.category.findUnique({ where: { id: categoryId } }), userId, NOT_FOUND);
    return this.toResource(row as CategoryRow);
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    await this.assertNameAvailable(userId, dto.name, dto.type);

    try {
      const row = await this.prisma.category.create({
        data: { userId, name: dto.name, type: dto.type, ...(dto.color !== undefined ? { color: dto.color } : {}) },
      });
      return this.toResource(row as CategoryRow);
    } catch (error) {
      // Race with a concurrent create: the index is the real authority.
      if (isUniqueViolation(error)) throw new ConflictException(duplicateMessage(dto.name, dto.type));
      throw error;
    }
  }

  async update(userId: string, categoryId: string, dto: UpdateCategoryDto): Promise<Category> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        // Ledger writes take the same row lock before attaching a category.
        // This makes the compatibility check and the type update one atomic
        // decision even when another request is creating a transaction.
        await tx.$queryRaw`SELECT id FROM categories WHERE id = ${categoryId}::text FOR UPDATE`;
        const existing = assertOwned(await tx.category.findUnique({ where: { id: categoryId } }), userId, NOT_FOUND);

        // Validate the FINAL state, not the patch: renaming only the type still
        // has to respect the (userId, name, type) uniqueness.
        const name = dto.name !== undefined ? dto.name : existing.name;
        const type = dto.type !== undefined ? dto.type : (existing.type as CategoryType);

        if (name !== existing.name || type !== existing.type) {
          const clash = await tx.category.findFirst({
            where: { userId, name, type, id: { not: categoryId } },
            select: { id: true },
          });
          if (clash) throw new ConflictException(duplicateMessage(name, type));
        }

        if (type !== existing.type && type !== 'both') {
          await this.assertReferencedTypesCompatible(tx, userId, categoryId, type);
        }

        return tx.category.update({
          where: { id: categoryId },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.type !== undefined ? { type: dto.type } : {}),
            ...(dto.color !== undefined ? { color: dto.color } : {}),
          },
        });
      });
      return this.toResource(row as CategoryRow);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const name = dto.name ?? 'informada';
        const type = dto.type ?? 'both';
        throw new ConflictException(duplicateMessage(name, type));
      }
      throw error;
    }
  }

  /**
   * Archive-or-delete: uma categoria usada por qualquer lançamento, lançamento
   * fixo, ocorrência ou meta é arquivada; só uma categoria sem nenhum vínculo é
   * realmente excluída.
   */
  async remove(userId: string, categoryId: string): Promise<Category> {
    const existing = assertOwned(
      await this.prisma.category.findUnique({ where: { id: categoryId } }),
      userId,
      NOT_FOUND,
    );

    const row = await this.prisma.$transaction(async (tx) => {
      const dependents = await this.countDependents(tx, userId, categoryId);
      if (dependents === 0) {
        await tx.category.delete({ where: { id: categoryId } });
        return existing;
      }
      if (!existing.isActive) return existing;
      return await tx.category.update({
        where: { id: categoryId },
        data: { isActive: false, archivedAt: new Date() },
      });
    });

    return this.toResource(row as CategoryRow);
  }

  async archive(userId: string, categoryId: string): Promise<Category> {
    const existing = assertOwned(
      await this.prisma.category.findUnique({ where: { id: categoryId } }),
      userId,
      NOT_FOUND,
    );
    if (!existing.isActive) return this.toResource(existing as CategoryRow);

    const row = await this.prisma.category.update({
      where: { id: categoryId },
      data: { isActive: false, archivedAt: new Date() },
    });
    return this.toResource(row as CategoryRow);
  }

  async restore(userId: string, categoryId: string): Promise<Category> {
    const existing = assertOwned(
      await this.prisma.category.findUnique({ where: { id: categoryId } }),
      userId,
      NOT_FOUND,
    );
    if (existing.isActive) return this.toResource(existing as CategoryRow);

    const row = await this.prisma.category.update({
      where: { id: categoryId },
      data: { isActive: true, archivedAt: null },
    });
    return this.toResource(row as CategoryRow);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async assertNameAvailable(
    userId: string,
    name: string,
    type: CategoryType,
    exceptId?: string,
  ): Promise<void> {
    const clash = await this.prisma.category.findFirst({
      where: { userId, name, type, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (clash) throw new ConflictException(duplicateMessage(name, type));
  }

  private async countDependents(tx: Prisma.TransactionClient, userId: string, categoryId: string): Promise<number> {
    const [transactions, fixedTransactions, occurrences, goals] = await Promise.all([
      tx.transaction.count({ where: { userId, categoryId } }),
      tx.fixedTransaction.count({ where: { userId, categoryId } }),
      tx.fixedTransactionOccurrence.count({ where: { userId, categoryId } }),
      tx.goal.count({ where: { userId, relatedCategoryId: categoryId } }),
    ]);
    return transactions + fixedTransactions + occurrences + goals;
  }

  private async assertReferencedTypesCompatible(
    tx: Prisma.TransactionClient,
    userId: string,
    categoryId: string,
    type: Exclude<CategoryType, 'both'>,
  ): Promise<void> {
    const incompatible = { not: type };
    const [transactions, fixedTransactions, occurrences] = await Promise.all([
      tx.transaction.count({ where: { userId, categoryId, type: incompatible } }),
      tx.fixedTransaction.count({ where: { userId, categoryId, type: incompatible } }),
      tx.fixedTransactionOccurrence.count({ where: { userId, categoryId, type: incompatible } }),
    ]);
    if (transactions + fixedTransactions + occurrences > 0) {
      throw new ConflictException(
        'Não é possível alterar o tipo: a categoria já possui lançamentos incompatíveis no histórico.',
      );
    }
  }

  private toResource(row: CategoryRow): Category {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      color: row.color ?? null,
      isActive: row.isActive,
      archivedAt: toIsoOrNull(row.archivedAt),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }
}
