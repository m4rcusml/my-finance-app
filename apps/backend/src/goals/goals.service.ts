import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsService } from 'src/accounts/accounts.service';
import { CategoriesService } from 'src/categories/categories.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { buildPaginatedResponse } from '../shared/pagination.dto';
import { CreateGoalDto, UpdateGoalDto } from './goals.dto';

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async createGoal(userId: string, dto: CreateGoalDto) {
    if (dto.relatedAccountId) {
      await this.validateAccount(userId, dto.relatedAccountId);
    }

    if (dto.relatedCategoryId) {
      await this.validateCategory(userId, dto.relatedCategoryId);
    }

    const goal = await this.prisma.goal.create({
      data: {
        ...dto,
        currentAmount: dto.currentAmount ?? 0,
        userId,
      },
    });

    return this.enrichWithProgress(goal);
  }

  async findAllByUser(userId: string, page = 1, limit = 20) {
    const [goals, total] = await Promise.all([
      this.prisma.goal.findMany({
        where: { userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.goal.count({ where: { userId } }),
    ]);

    return buildPaginatedResponse(
      goals.map((goal) => this.enrichWithProgress(goal)),
      total,
      page,
      limit,
    );
  }

  async findById(userId: string, goalId: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
    });

    if (!goal) {
      throw new NotFoundException();
    }

    if (goal.userId !== userId) {
      throw new ForbiddenException();
    }

    return this.enrichWithProgress(goal);
  }

  async updateGoal(userId: string, goalId: string, dto: UpdateGoalDto) {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
    });

    if (!goal) {
      throw new NotFoundException();
    }

    if (goal.userId !== userId) {
      throw new ForbiddenException();
    }

    if (dto.relatedAccountId) {
      await this.validateAccount(userId, dto.relatedAccountId);
    }

    if (dto.relatedCategoryId) {
      await this.validateCategory(userId, dto.relatedCategoryId);
    }

    const updated = await this.prisma.goal.update({
      data: dto,
      where: { id: goalId },
    });

    return this.enrichWithProgress(updated);
  }

  async deleteGoal(userId: string, goalId: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
    });

    if (!goal) {
      throw new NotFoundException();
    }

    if (goal.userId !== userId) {
      throw new ForbiddenException();
    }

    await this.prisma.goal.delete({
      where: { id: goalId },
    });
  }

  private async validateAccount(userId: string, accountId: string): Promise<void> {
    try {
      await this.accountsService.findById(userId, accountId);
    } catch {
      throw new BadRequestException('relatedAccount not found or does not belong to user');
    }
  }

  private async validateCategory(userId: string, categoryId: string): Promise<void> {
    try {
      await this.categoriesService.findById(userId, categoryId);
    } catch {
      throw new BadRequestException('relatedCategory not found or does not belong to user');
    }
  }

  private enrichWithProgress(goal: any): any {
    const current = this.toNumber(goal.currentAmount);
    const target = this.toNumber(goal.targetAmount);
    const progress = target > 0 ? Number((current / target).toFixed(4)) : 0;

    return {
      ...goal,
      progress,
    };
  }

  private toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    if (typeof value.toNumber === 'function') return value.toNumber();
    if (typeof value.valueOf === 'function') return value.valueOf();
    return Number(value);
  }
}
