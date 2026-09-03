import type { Goal, GoalType, PaginatedResponse } from '@finance/contracts';
import { Injectable } from '@nestjs/common';
import { fromCivilDate, parseCivilDate, toCivilDate } from '../common/civil-date';
import { toMoney } from '../common/money';
import { assertOwned } from '../common/ownership';
import { buildPaginatedResponse, resolvePagination } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateGoalDto, UpdateGoalDto } from './goals.dto';

/** Structural view of the row this service reads, so the unit tests can fake it. */
interface GoalRow {
  id: string;
  userId: string;
  name: string;
  type: string;
  targetAmount: unknown;
  currentAmount: unknown;
  deadline: Date | string | null;
  relatedCategoryId: string | null;
  relatedAccountId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

function toIso(value: Date | string): string {
  return typeof value === 'string' ? value : value.toISOString();
}

/**
 * `currentAmount / targetAmount`, clamped to `[0, 1]` and rounded to 4 places.
 *
 * The clamp is the point: a user who overshoots a goal must not see 137% in a
 * progress bar, and `targetAmount` is guaranteed positive by the DTO, so the
 * zero branch only ever protects against legacy rows.
 */
export function computeProgress(currentAmount: number, targetAmount: number): number {
  if (!(targetAmount > 0)) return 0;
  const ratio = Math.min(1, Math.max(0, currentAmount / targetAmount));
  return Math.round((ratio + Number.EPSILON) * 1e4) / 1e4;
}

function toGoal(row: GoalRow): Goal {
  const targetAmount = toMoney(row.targetAmount);
  const currentAmount = toMoney(row.currentAmount);

  return {
    id: row.id,
    name: row.name,
    type: row.type as GoalType,
    targetAmount,
    currentAmount,
    deadline: row.deadline ? toCivilDate(row.deadline) : null,
    relatedCategoryId: row.relatedCategoryId ?? null,
    relatedAccountId: row.relatedAccountId ?? null,
    progress: computeProgress(currentAmount, targetAmount),
    // V1 never derives progress from transactions; the literal exists so the UI
    // can label the number as hand-entered instead of implying it is tracked.
    progressSource: 'manual',
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

/**
 * Savings/limit goals with **manual** progress.
 *
 * `currentAmount` is whatever the user last typed — nothing in V1 reads
 * transactions to move it. `relatedCategoryId` and `relatedAccountId` are pure
 * labels for the UI: they are ownership-checked when set, but they never feed
 * into `progress`.
 */
@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateGoalDto): Promise<Goal> {
    const relatedCategoryId = dto.relatedCategoryId ?? null;
    const relatedAccountId = dto.relatedAccountId ?? null;

    if (relatedCategoryId !== null) await this.assertCategoryOwned(userId, relatedCategoryId);
    if (relatedAccountId !== null) await this.assertAccountOwned(userId, relatedAccountId);

    const deadline = dto.deadline ? parseCivilDate(dto.deadline, 'deadline') : null;

    const created = await this.prisma.goal.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        targetAmount: dto.targetAmount,
        currentAmount: dto.currentAmount ?? 0,
        deadline: deadline === null ? null : fromCivilDate(deadline),
        relatedCategoryId,
        relatedAccountId,
      },
    });

    return toGoal(created as unknown as GoalRow);
  }

  async findAll(userId: string, query?: { page?: number; limit?: number }): Promise<PaginatedResponse<Goal>> {
    const { page, limit, skip } = resolvePagination(query);
    const where = { userId };

    const [rows, totalItems] = await Promise.all([
      this.prisma.goal.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.goal.count({ where }),
    ]);

    return buildPaginatedResponse((rows as unknown as GoalRow[]).map(toGoal), totalItems, page, limit);
  }

  async findOne(userId: string, goalId: string): Promise<Goal> {
    return toGoal(await this.getOwned(userId, goalId));
  }

  /**
   * PATCH: omitted keys stay untouched; `deadline`, `relatedCategoryId` and
   * `relatedAccountId` accept an explicit `null` that clears them. Relations are
   * ownership-checked before the write, never after.
   */
  async update(userId: string, goalId: string, dto: UpdateGoalDto): Promise<Goal> {
    await this.getOwned(userId, goalId);

    if (dto.relatedCategoryId !== undefined && dto.relatedCategoryId !== null) {
      await this.assertCategoryOwned(userId, dto.relatedCategoryId);
    }
    if (dto.relatedAccountId !== undefined && dto.relatedAccountId !== null) {
      await this.assertAccountOwned(userId, dto.relatedAccountId);
    }

    const deadline =
      dto.deadline === undefined
        ? undefined
        : dto.deadline === null
          ? null
          : fromCivilDate(parseCivilDate(dto.deadline, 'deadline'));

    const updated = await this.prisma.goal.update({
      where: { id: goalId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.targetAmount !== undefined ? { targetAmount: dto.targetAmount } : {}),
        ...(dto.currentAmount !== undefined ? { currentAmount: dto.currentAmount } : {}),
        ...(deadline !== undefined ? { deadline } : {}),
        ...(dto.relatedCategoryId !== undefined ? { relatedCategoryId: dto.relatedCategoryId } : {}),
        ...(dto.relatedAccountId !== undefined ? { relatedAccountId: dto.relatedAccountId } : {}),
      },
    });

    return toGoal(updated as unknown as GoalRow);
  }

  /** Convenience wrapper for the progress route; validated exactly like `update`. */
  async updateProgress(userId: string, goalId: string, currentAmount: number): Promise<Goal> {
    return this.update(userId, goalId, { currentAmount });
  }

  /** Nothing references a goal, so a hard delete destroys no history. */
  async remove(userId: string, goalId: string): Promise<void> {
    await this.getOwned(userId, goalId);
    await this.prisma.goal.delete({ where: { id: goalId } });
  }

  private async getOwned(userId: string, goalId: string): Promise<GoalRow> {
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } });
    return assertOwned(goal as unknown as GoalRow | null, userId, 'Objetivo');
  }

  private async assertAccountOwned(userId: string, accountId: string): Promise<void> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, userId: true },
    });
    assertOwned(account, userId, 'Vínculo de conta');
  }

  private async assertCategoryOwned(userId: string, categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, userId: true },
    });
    assertOwned(category, userId, 'Vínculo de categoria');
  }
}
