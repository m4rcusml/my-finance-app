import { type BillingCycle, buildPaginatedResponse, type CreditCard, type PaginatedResponse } from '@finance/contracts';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { billingCycleFor, type CivilDate, inclusiveRange, todayIn } from '../common/civil-date';
import { sumMoney, toMoney } from '../common/money';
import { assertOwned } from '../common/ownership';
import { resolvePagination } from '../common/pagination.dto';
import type { EnvConfig } from '../config/env';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCreditCardDto, ListCreditCardsQueryDto, UpdateCreditCardDto } from './credit-cards.dto';

/** The columns a response is built from — never the joined `transactions`. */
type CreditCardRow = {
  id: string;
  userId: string;
  name: string;
  institution: string;
  limitTotal: unknown;
  closingDay: number | null;
  isActive: boolean;
  archivedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

/** Each card carries its own cycle window, so a page needs its own bound. */
type CycleUsage = { cycle: BillingCycle; used: number };

/** Hard ceiling for the dashboard aggregate; nobody has 200 cards. */
const MAX_CARDS_FOR_TOTALS = 200;

const NOT_FOUND = 'Cartão';

function toIso(value: Date | string): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  return value === null || value === undefined ? null : toIso(value);
}

@Injectable()
export class CreditCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async findAll(userId: string, query: ListCreditCardsQueryDto = {}): Promise<PaginatedResponse<CreditCard>> {
    const { page, limit, skip } = resolvePagination(query);
    const where = { userId, ...(query.includeArchived === true ? {} : { isActive: true }) };

    const [rows, totalItems] = await Promise.all([
      this.prisma.creditCard.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.creditCard.count({ where }),
    ]);

    // One aggregate for the whole page, whatever the transaction volume.
    const usage = await this.cycleUsage(userId, rows as CreditCardRow[], this.today());
    const data = (rows as CreditCardRow[]).map((row) => this.toResource(row, usage.get(row.id)));

    return buildPaginatedResponse(data, totalItems, page, limit);
  }

  async findOne(userId: string, creditCardId: string): Promise<CreditCard> {
    const row = assertOwned(
      await this.prisma.creditCard.findUnique({ where: { id: creditCardId } }),
      userId,
      NOT_FOUND,
    );
    return await this.withUsage(userId, row as CreditCardRow);
  }

  /**
   * Dashboard helper: limite, uso do ciclo aberto e disponível somados. The
   * per-card windows differ (each card has its own `closingDay`), so the card
   * rows are read once — bounded — and the expenses are folded by a single
   * `groupBy` aggregate. No transaction row ever reaches Node.
   */
  async getCycleTotals(userId: string): Promise<{ totalLimit: number; totalUsed: number; totalAvailable: number }> {
    const cards = await this.prisma.creditCard.findMany({
      where: { userId, isActive: true },
      select: { id: true, limitTotal: true, closingDay: true },
      take: MAX_CARDS_FOR_TOTALS,
    });

    const usage = await this.cycleUsage(userId, cards, this.today());

    const totalLimit = sumMoney(cards.map((card) => toMoney(card.limitTotal)));
    const totalUsed = sumMoney(cards.map((card) => usage.get(card.id)?.used ?? 0));

    return { totalLimit, totalUsed, totalAvailable: sumMoney([totalLimit, -totalUsed]) };
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  async create(userId: string, dto: CreateCreditCardDto): Promise<CreditCard> {
    const row = await this.prisma.creditCard.create({
      data: {
        userId,
        name: dto.name,
        institution: dto.institution,
        limitTotal: dto.limitTotal,
        closingDay: dto.closingDay ?? null,
      },
    });
    // Same shape as GET: a new card has no expenses, but it does have a cycle.
    return await this.withUsage(userId, row as CreditCardRow);
  }

  async update(userId: string, creditCardId: string, dto: UpdateCreditCardDto): Promise<CreditCard> {
    assertOwned(await this.prisma.creditCard.findUnique({ where: { id: creditCardId } }), userId, NOT_FOUND);

    const row = await this.prisma.creditCard.update({
      where: { id: creditCardId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.institution !== undefined ? { institution: dto.institution } : {}),
        ...(dto.limitTotal !== undefined ? { limitTotal: dto.limitTotal } : {}),
        // `null` is a meaningful "clear it"; `undefined` leaves it untouched.
        ...(dto.closingDay !== undefined ? { closingDay: dto.closingDay } : {}),
      },
    });

    return await this.withUsage(userId, row as CreditCardRow);
  }

  /**
   * Archive-or-delete: um cartão com qualquer lançamento, lançamento fixo ou
   * ocorrência é arquivado; só um cartão sem vínculo nenhum é excluído.
   */
  async remove(userId: string, creditCardId: string): Promise<CreditCard> {
    const existing = assertOwned(
      await this.prisma.creditCard.findUnique({ where: { id: creditCardId } }),
      userId,
      NOT_FOUND,
    );

    const row = await this.prisma.$transaction(async (tx) => {
      const dependents = await this.countDependents(tx, userId, creditCardId);
      if (dependents === 0) {
        await tx.creditCard.delete({ where: { id: creditCardId } });
        return existing;
      }
      if (!existing.isActive) return existing;
      return await tx.creditCard.update({
        where: { id: creditCardId },
        data: { isActive: false, archivedAt: new Date() },
      });
    });

    return await this.withUsage(userId, row as CreditCardRow);
  }

  async archive(userId: string, creditCardId: string): Promise<CreditCard> {
    const existing = assertOwned(
      await this.prisma.creditCard.findUnique({ where: { id: creditCardId } }),
      userId,
      NOT_FOUND,
    );
    if (!existing.isActive) return await this.withUsage(userId, existing as CreditCardRow);

    const row = await this.prisma.creditCard.update({
      where: { id: creditCardId },
      data: { isActive: false, archivedAt: new Date() },
    });
    return await this.withUsage(userId, row as CreditCardRow);
  }

  async restore(userId: string, creditCardId: string): Promise<CreditCard> {
    const existing = assertOwned(
      await this.prisma.creditCard.findUnique({ where: { id: creditCardId } }),
      userId,
      NOT_FOUND,
    );
    if (existing.isActive) return await this.withUsage(userId, existing as CreditCardRow);

    const row = await this.prisma.creditCard.update({
      where: { id: creditCardId },
      data: { isActive: true, archivedAt: null },
    });
    return await this.withUsage(userId, row as CreditCardRow);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private today(): CivilDate {
    return todayIn(this.config.get('APP_TIMEZONE', { infer: true }));
  }

  /**
   * Expenses inside the **current open cycle** of each card.
   *
   * The window comes from `billingCycleFor(today, closingDay)`, so a card that
   * closes on the 10th stops counting last month's invoice — the old code
   * summed every expense the card ever had and called it "used".
   */
  private async cycleUsage(
    userId: string,
    cards: { id: string; closingDay: number | null }[],
    today: CivilDate,
  ): Promise<Map<string, CycleUsage>> {
    const usage = new Map<string, CycleUsage>();
    for (const card of cards) {
      usage.set(card.id, { cycle: billingCycleFor(today, card.closingDay), used: 0 });
    }
    if (usage.size === 0) return usage;

    const grouped = await this.prisma.transaction.groupBy({
      by: ['creditCardId'],
      where: {
        userId,
        type: 'expense',
        OR: [...usage.entries()].map(([creditCardId, { cycle }]) => ({
          creditCardId,
          date: inclusiveRange(cycle.start, cycle.end),
        })),
      },
      _sum: { value: true },
    });

    for (const group of grouped) {
      const creditCardId = group.creditCardId;
      if (!creditCardId) continue;
      const entry = usage.get(creditCardId);
      if (!entry) continue;
      entry.used = toMoney(group._sum?.value);
    }

    return usage;
  }

  private async withUsage(userId: string, row: CreditCardRow): Promise<CreditCard> {
    const usage = await this.cycleUsage(userId, [row], this.today());
    return this.toResource(row, usage.get(row.id));
  }

  private toResource(row: CreditCardRow, usage: CycleUsage | undefined): CreditCard {
    const cycle = usage?.cycle ?? billingCycleFor(this.today(), row.closingDay);
    const limitTotal = toMoney(row.limitTotal);
    const cycleUsedAmount = usage?.used ?? 0;

    return {
      id: row.id,
      name: row.name,
      institution: row.institution,
      limitTotal,
      closingDay: row.closingDay,
      cycleUsedAmount,
      // Deliberately not floored at zero: a card over its limit must show it.
      availableAmount: sumMoney([limitTotal, -cycleUsedAmount]),
      currentCycle: { start: cycle.start, end: cycle.end },
      isActive: row.isActive,
      archivedAt: toIsoOrNull(row.archivedAt),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private async countDependents(tx: Prisma.TransactionClient, userId: string, creditCardId: string): Promise<number> {
    const [transactions, fixedTransactions, occurrences] = await Promise.all([
      tx.transaction.count({ where: { userId, creditCardId } }),
      tx.fixedTransaction.count({ where: { userId, creditCardId } }),
      tx.fixedTransactionOccurrence.count({ where: { userId, creditCardId } }),
    ]);
    return transactions + fixedTransactions + occurrences;
  }
}
