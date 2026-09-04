import type { FixedTransaction, PaginatedResponse } from '@finance/contracts';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromCivilDate } from '../common/civil-date';
import { toMoney } from '../common/money';
import { assertOwned } from '../common/ownership';
import { buildPaginatedResponse, resolvePagination } from '../common/pagination.dto';
import { assertTransactionRelationsWritable } from '../common/writable-transaction-relations';
import type { EnvConfig } from '../config/env';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateFixedTransactionDto,
  ListFixedTransactionsQueryDto,
  UpdateFixedTransactionDto,
} from './fixed-transactions.dto';
import { type FixedTransactionRow, toFixedTransaction } from './fixed-transactions.mapper';
import { afterPeriodWhere, currentPeriod, dueDateFor, type Period } from './recurrence';

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

/**
 * Upper bound on how many future pending occurrences a single edit rewrites.
 * The generator only ever runs one period ahead, so this is slack, not a limit
 * a real template can hit — but it keeps an unbounded `findMany` out of the code.
 */
const MAX_FUTURE_OCCURRENCES = 120;

/** The final state a PATCH produces, before any of it reaches the database. */
interface FinalTemplateState {
  type: FixedTransaction['type'];
  value: number;
  referenceDay: number;
  marginDays: number;
  accountId: string | null;
  creditCardId: string | null;
  categoryId: string;
  description: string | null;
  isActive: boolean;
}

@Injectable()
export class FixedTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async findAll(userId: string, query: ListFixedTransactionsQueryDto): Promise<PaginatedResponse<FixedTransaction>> {
    const { page, limit, skip } = resolvePagination(query);
    const where = {
      userId,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.type === undefined ? {} : { type: query.type }),
    };

    const [rows, totalItems] = await Promise.all([
      this.prisma.fixedTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.fixedTransaction.count({ where }),
    ]);

    return buildPaginatedResponse(rows.map(toFixedTransaction), totalItems, page, limit);
  }

  async findOne(userId: string, id: string): Promise<FixedTransaction> {
    return toFixedTransaction(await this.loadOwned(userId, id));
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  async create(userId: string, dto: CreateFixedTransactionDto): Promise<FixedTransaction> {
    const accountId = dto.accountId ?? null;
    const creditCardId = dto.creditCardId ?? null;
    this.assertExactlyOneSource(accountId, creditCardId);

    const created = await this.prisma.$transaction(async (tx) => {
      await assertTransactionRelationsWritable(tx, userId, {
        accountId,
        creditCardId,
        categoryId: dto.categoryId,
        type: dto.type,
      });

      const row = await tx.fixedTransaction.create({
        data: {
          userId,
          type: dto.type,
          value: dto.value,
          referenceDay: dto.referenceDay,
          marginDays: dto.marginDays ?? 0,
          accountId,
          creditCardId,
          categoryId: dto.categoryId,
          description: dto.description ?? null,
        },
      });
      await this.ensureCurrentOccurrence(tx, row, this.currentPeriod());
      return row;
    });

    return toFixedTransaction(created);
  }

  /**
   * PATCH. The final row is computed first and validated as a whole, then the
   * write and the propagation to *future* occurrences happen in one transaction.
   */
  async update(userId: string, id: string, dto: UpdateFixedTransactionDto): Promise<FixedTransaction> {
    const current = await this.loadOwned(userId, id);

    const final: FinalTemplateState = {
      type: dto.type ?? current.type,
      value: dto.value ?? toMoney(current.value),
      referenceDay: dto.referenceDay ?? current.referenceDay,
      marginDays: dto.marginDays ?? current.marginDays,
      accountId: dto.accountId === undefined ? current.accountId : dto.accountId,
      creditCardId: dto.creditCardId === undefined ? current.creditCardId : dto.creditCardId,
      categoryId: dto.categoryId ?? current.categoryId,
      description: dto.description === undefined ? current.description : dto.description,
      isActive: dto.isActive ?? current.isActive,
    };

    this.assertExactlyOneSource(final.accountId, final.creditCardId);

    const deactivating = current.isActive && !final.isActive;
    const reactivating = !current.isActive && final.isActive;
    const relationsChanged =
      final.type !== current.type ||
      final.categoryId !== current.categoryId ||
      final.accountId !== current.accountId ||
      final.creditCardId !== current.creditCardId;
    const period = this.currentPeriod();

    const updated = await this.prisma.$transaction(async (tx) => {
      if (reactivating || relationsChanged) {
        await assertTransactionRelationsWritable(tx, userId, {
          accountId: final.accountId,
          creditCardId: final.creditCardId,
          categoryId: final.categoryId,
          type: final.type,
        });
      }

      const row = await tx.fixedTransaction.update({
        where: { id },
        data: {
          type: final.type,
          value: final.value,
          referenceDay: final.referenceDay,
          marginDays: final.marginDays,
          accountId: final.accountId,
          creditCardId: final.creditCardId,
          categoryId: final.categoryId,
          description: final.description,
          isActive: final.isActive,
          ...(deactivating ? { archivedAt: new Date() } : {}),
          ...(reactivating ? { archivedAt: null } : {}),
        },
      });

      if (final.isActive) {
        await this.propagateToFutureOccurrences(tx, userId, id, final, period);
        if (reactivating) await this.ensureCurrentOccurrence(tx, row, period);
      } else {
        await this.dropFutureOccurrences(tx, userId, id, period);
      }

      return row;
    });

    return toFixedTransaction(updated);
  }

  /**
   * Archive, never delete. The occurrence -> template FK is `RESTRICT`, so a
   * hard delete of a template that ever generated a period is impossible by
   * construction; archiving is the only operation that keeps history readable.
   */
  async archive(userId: string, id: string): Promise<FixedTransaction> {
    const current = await this.loadOwned(userId, id);
    if (!current.isActive) return toFixedTransaction(current);

    const period = this.currentPeriod();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.fixedTransaction.update({
        where: { id },
        data: { isActive: false, archivedAt: new Date() },
      });
      await this.dropFutureOccurrences(tx, userId, id, period);
      return row;
    });

    return toFixedTransaction(updated);
  }

  async restore(userId: string, id: string): Promise<FixedTransaction> {
    const current = await this.loadOwned(userId, id);
    if (current.isActive) return toFixedTransaction(current);

    const updated = await this.prisma.$transaction(async (tx) => {
      await assertTransactionRelationsWritable(tx, userId, {
        accountId: current.accountId,
        creditCardId: current.creditCardId,
        categoryId: current.categoryId,
        type: current.type,
      });
      const row = await tx.fixedTransaction.update({
        where: { id },
        data: { isActive: true, archivedAt: null },
      });
      await this.ensureCurrentOccurrence(tx, row, this.currentPeriod());
      return row;
    });

    return toFixedTransaction(updated);
  }

  /** `DELETE` is an archive. Nothing in this module ever destroys a template. */
  async remove(userId: string, id: string): Promise<void> {
    await this.archive(userId, id);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private currentPeriod(): Period {
    const timeZone = this.config.get('APP_TIMEZONE', { infer: true }) ?? DEFAULT_TIME_ZONE;
    return currentPeriod(timeZone);
  }

  /** Make the current month usable immediately, independently of the daily job.
   * The unique template/period key makes restore and cron races idempotent;
   * existing pending or final occurrences retain their original snapshot.
   */
  private async ensureCurrentOccurrence(
    tx: Prisma.TransactionClient,
    row: FixedTransactionRow,
    period: Period,
  ): Promise<void> {
    await tx.fixedTransactionOccurrence.createMany({
      data: [
        {
          userId: row.userId,
          fixedTransactionId: row.id,
          periodYear: period.year,
          periodMonth: period.month,
          dueDate: fromCivilDate(dueDateFor(period, row.referenceDay)),
          type: row.type,
          value: toMoney(row.value),
          description: row.description,
          categoryId: row.categoryId,
          accountId: row.accountId,
          creditCardId: row.creditCardId,
          status: 'pending',
        },
      ],
      skipDuplicates: true,
    });
  }

  private async loadOwned(userId: string, id: string): Promise<FixedTransactionRow> {
    const row = await this.prisma.fixedTransaction.findFirst({ where: { id, userId } });
    return assertOwned(row, userId, 'Lançamento fixo');
  }

  private assertExactlyOneSource(accountId: string | null, creditCardId: string | null): void {
    if (Boolean(accountId) === Boolean(creditCardId)) {
      throw new BadRequestException('Informe exatamente uma origem: accountId ou creditCardId.');
    }
  }

  /**
   * Refresh the snapshot carried by occurrences that have not happened yet.
   * Rows at or before the current period, and rows that are no longer `pending`,
   * are never touched — an edit today must not rewrite what already occurred.
   */
  private async propagateToFutureOccurrences(
    tx: Prisma.TransactionClient,
    userId: string,
    fixedTransactionId: string,
    final: FinalTemplateState,
    period: Period,
  ): Promise<void> {
    const where = {
      fixedTransactionId,
      userId,
      status: 'pending' as const,
      ...afterPeriodWhere(period),
    };

    await tx.fixedTransactionOccurrence.updateMany({
      where,
      data: {
        type: final.type,
        value: final.value,
        description: final.description,
        categoryId: final.categoryId,
        accountId: final.accountId,
        creditCardId: final.creditCardId,
      },
    });

    // `dueDate` is per-period (the reference day clamps to each month), so it
    // cannot be set by a single `updateMany`.
    const future = await tx.fixedTransactionOccurrence.findMany({
      where,
      select: { id: true, periodYear: true, periodMonth: true },
      orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }],
      take: MAX_FUTURE_OCCURRENCES,
    });

    for (const row of future) {
      const dueDate = dueDateFor({ year: row.periodYear, month: row.periodMonth }, final.referenceDay);
      await tx.fixedTransactionOccurrence.update({
        where: { id: row.id },
        data: { dueDate: fromCivilDate(dueDate) },
      });
    }
  }

  /**
   * Archiving a template removes only its *unconfirmed, future* placeholders.
   * Those rows carry no transaction (`transactionId: null` is checked, as the
   * no-dependents rule requires) and were generated by the cron rather than by
   * the user, so dropping them destroys no history — and restoring the template
   * lets the generator recreate them.
   */
  private async dropFutureOccurrences(
    tx: Prisma.TransactionClient,
    userId: string,
    fixedTransactionId: string,
    period: Period,
  ): Promise<void> {
    await tx.fixedTransactionOccurrence.deleteMany({
      where: {
        fixedTransactionId,
        userId,
        status: 'pending',
        transactionId: null,
        ...afterPeriodWhere(period),
      },
    });
  }
}
