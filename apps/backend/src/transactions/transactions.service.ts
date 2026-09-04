import {
  buildPaginatedResponse,
  type Category,
  type CivilDate,
  type ExpenseProjection,
  type MonthlyNet,
  type PaginatedResponse,
  type Transaction,
  type TransactionSource,
  type TransactionSummary,
  type TransactionType,
  type TransactionWithRelations,
} from '@finance/contracts';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  addDays,
  addMonths,
  compareCivilDates,
  endOfMonth,
  fromCivilDate,
  inclusiveRange,
  monthKey,
  parseCivilDate,
  startOfMonth,
  toCivilDate,
  todayIn,
} from '../common/civil-date';
import { roundMoney, sumMoney, toMoney } from '../common/money';
import { assertOwned } from '../common/ownership';
import { resolvePagination } from '../common/pagination.dto';
import {
  assertExactlyOneTransactionSource,
  assertTransactionRelationsWritable,
} from '../common/writable-transaction-relations';
import type { EnvConfig } from '../config/env';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  type CreateTransactionDto,
  DEFAULT_PROJECTION_MONTHS,
  type ListTransactionsQueryDto,
  MAX_PROJECTION_MONTHS,
  type UpdateTransactionDto,
} from './transactions.dto';

/**
 * Deterministic order for every listing.
 *
 * `date` alone is not a total order — a user importing a statement gets dozens
 * of rows on the same day, and PostgreSQL is free to return them in a different
 * order on each query, so page 2 could repeat or skip rows from page 1.
 * `createdAt` then `id` break every remaining tie.
 */
const STABLE_ORDER: Prisma.TransactionOrderByWithRelationInput[] = [
  { date: 'desc' },
  { createdAt: 'desc' },
  { id: 'desc' },
];

/** The labels list screens need, so the UI never has to render a raw UUID. */
const WITH_RELATIONS = {
  category: { select: { id: true, name: true, type: true } },
  account: { select: { id: true, name: true } },
  creditCard: { select: { id: true, name: true } },
} as const;

/** Hard ceiling for `monthlyNetSeries`, so a bad range cannot spin forever. */
const MAX_SERIES_MONTHS = 120;

const NOT_FOUND = 'Lançamento';

/** The columns a response is built from. */
type TransactionRow = {
  id: string;
  userId: string;
  type: TransactionType;
  value: unknown;
  date: Date | string;
  accountId: string | null;
  creditCardId: string | null;
  categoryId: string | null;
  description: string | null;
  source: TransactionSource;
  externalId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type TransactionRowWithRelations = TransactionRow & {
  category: { id: string; name: string; type: Category['type'] } | null;
  account: { id: string; name: string } | null;
  creditCard: { id: string; name: string } | null;
};

/** Totals over a civil-date window. Consumed by the dashboard. */
export interface PeriodAggregate {
  income: number;
  expense: number;
  net: number;
  count: number;
}

/**
 * Extra knobs the HTTP layer must never expose.
 *
 * `source`/`externalId` are set by the import and recurrence flows, not by the
 * client — the DTO deliberately has no such fields, so a request cannot forge
 * a row that looks like it came from a bank statement.
 */
export interface CreateTransactionOptions {
  source?: TransactionSource;
  externalId?: string | null;
  importBatchId?: string | null;
  /** Join an outer `$transaction` instead of opening a new one. */
  tx?: Prisma.TransactionClient;
}

function toIso(value: Date | string): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    value: toMoney(row.value),
    date: toCivilDate(row.date),
    accountId: row.accountId,
    creditCardId: row.creditCardId,
    categoryId: row.categoryId,
    description: row.description,
    source: row.source,
    externalId: row.externalId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function toTransactionWithRelations(row: TransactionRowWithRelations): TransactionWithRelations {
  return {
    ...toTransaction(row),
    category: row.category ? { id: row.category.id, name: row.category.name, type: row.category.type } : null,
    account: row.account ? { id: row.account.id, name: row.account.name } : null,
    creditCard: row.creditCard ? { id: row.creditCard.id, name: row.creditCard.name } : null,
  };
}

/** Accepts both `YYYY-MM` and a civil date, and returns the first day of that month. */
function monthStart(value: string, field: string): CivilDate {
  const candidate = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
  return startOfMonth(parseCivilDate(candidate, field));
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  /**
   * Creates a transaction with exactly one source (account XOR credit card).
   *
   * Both ids are validated for ownership *and* for not being archived, inside
   * the same transaction as the insert, so a card archived a millisecond ago
   * cannot still receive a new expense.
   */
  async create(
    userId: string,
    dto: CreateTransactionDto,
    options: CreateTransactionOptions = {},
  ): Promise<Transaction> {
    const date = parseCivilDate(dto.date, 'date');
    const accountId = dto.accountId ?? null;
    const creditCardId = dto.creditCardId ?? null;
    const categoryId = dto.categoryId ?? null;

    assertExactlyOneTransactionSource(accountId, creditCardId);

    const write = async (tx: Prisma.TransactionClient): Promise<TransactionRow> => {
      await assertTransactionRelationsWritable(tx, userId, { accountId, creditCardId, categoryId, type: dto.type });
      return tx.transaction.create({
        data: {
          userId,
          type: dto.type,
          value: dto.value,
          date: fromCivilDate(date),
          accountId,
          creditCardId,
          categoryId,
          description: dto.description ?? null,
          source: options.source ?? 'manual',
          externalId: options.externalId ?? null,
          importBatchId: options.importBatchId ?? null,
        },
      });
    };

    const row = options.tx ? await write(options.tx) : await this.prisma.$transaction(write);
    return toTransaction(row);
  }

  /**
   * PATCH with final-state validation.
   *
   * An absent key keeps the current value, an explicit `null` clears it. The
   * exactly-one-source rule is checked against the *result* of the patch: the
   * old code validated the patch alone, so `{ creditCardId }` on an
   * account-backed row produced a transaction with both sources set — which the
   * balance and invoice math then counted twice.
   */
  async update(userId: string, id: string, dto: UpdateTransactionDto): Promise<Transaction> {
    const row = await this.prisma.$transaction(async (tx) => {
      const current = assertOwned(await tx.transaction.findUnique({ where: { id } }), userId, NOT_FOUND);

      const finalAccountId = dto.accountId !== undefined ? dto.accountId : current.accountId;
      const finalCreditCardId = dto.creditCardId !== undefined ? dto.creditCardId : current.creditCardId;
      const finalCategoryId = dto.categoryId !== undefined ? dto.categoryId : current.categoryId;
      const finalType = dto.type !== undefined ? dto.type : current.type;

      assertExactlyOneTransactionSource(finalAccountId, finalCreditCardId);

      // Only ids that actually change are re-validated: a row already pointing
      // at an archived account keeps working, it just cannot move to one.
      await assertTransactionRelationsWritable(tx, userId, {
        accountId: finalAccountId !== current.accountId ? finalAccountId : null,
        creditCardId: finalCreditCardId !== current.creditCardId ? finalCreditCardId : null,
        categoryId: finalCategoryId !== current.categoryId || finalType !== current.type ? finalCategoryId : null,
        type: finalType,
      });

      const data: Prisma.TransactionUncheckedUpdateInput = {};
      if (dto.type !== undefined) data.type = dto.type;
      if (dto.value !== undefined) data.value = dto.value;
      if (dto.date !== undefined) data.date = fromCivilDate(parseCivilDate(dto.date, 'date'));
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.accountId !== undefined) data.accountId = finalAccountId;
      if (dto.creditCardId !== undefined) data.creditCardId = finalCreditCardId;
      if (dto.categoryId !== undefined) data.categoryId = finalCategoryId;

      return tx.transaction.update({ where: { id: current.id }, data });
    });

    return toTransaction(row);
  }

  /**
   * Hard-deletes a manual transaction.
   *
   * A row created by confirming a recurrence occurrence is history: the FK is
   * `onDelete: SetNull`, so deleting it here would silently detach the
   * occurrence and leave a "confirmed" period with nothing behind it. The user
   * has to undo the occurrence first.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = assertOwned(await tx.transaction.findUnique({ where: { id } }), userId, NOT_FOUND);

      const linkedOccurrence = await tx.fixedTransactionOccurrence.findFirst({
        where: { userId, transactionId: current.id },
        select: { id: true },
      });
      if (linkedOccurrence) {
        throw new ConflictException(
          'Este lançamento veio da confirmação de uma recorrência. Desfaça a confirmação da ocorrência antes de excluí-lo.',
        );
      }

      await tx.transaction.delete({ where: { id: current.id } });
    });
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async findAllByUser(
    userId: string,
    query: ListTransactionsQueryDto = {},
  ): Promise<PaginatedResponse<TransactionWithRelations>> {
    return this.list(this.buildWhere(userId, query), query);
  }

  /** House-style alias of {@link findAllByUser}. */
  async findAll(
    userId: string,
    query: ListTransactionsQueryDto = {},
  ): Promise<PaginatedResponse<TransactionWithRelations>> {
    return this.findAllByUser(userId, query);
  }

  /** Same filters as the main listing, pinned to rows with no category. */
  async findUncategorized(
    userId: string,
    query: ListTransactionsQueryDto = {},
  ): Promise<PaginatedResponse<TransactionWithRelations>> {
    return this.list({ ...this.buildWhere(userId, query), categoryId: null }, query);
  }

  async findById(userId: string, id: string): Promise<Transaction> {
    const row = await this.prisma.transaction.findUnique({ where: { id } });
    return toTransaction(assertOwned(row, userId, NOT_FOUND));
  }

  /** Badge on the "sem categoria" shortcut. One `COUNT`, never a page of rows. */
  async countUncategorized(userId: string): Promise<number> {
    return this.prisma.transaction.count({ where: { userId, categoryId: null } });
  }

  // -------------------------------------------------------------------------
  // Aggregates
  // -------------------------------------------------------------------------

  /**
   * Totals for an inclusive civil-date window, computed by the database.
   *
   * This is what the dashboard must call. Summing `findAllByUser(...).data`
   * only ever totalled the first page — 20 rows — and quietly under-reported
   * every month with more activity than that.
   */
  async aggregateByPeriod(userId: string, from: CivilDate, to: CivilDate): Promise<PeriodAggregate> {
    const { start, end } = this.assertWindow(from, to, 'from', 'to');

    const groups = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { userId, date: inclusiveRange(start, end) },
      _sum: { value: true },
      _count: { _all: true },
    });

    let income = 0;
    let expense = 0;
    let count = 0;
    for (const group of groups) {
      const total = toMoney(group._sum.value);
      count += group._count._all;
      if (group.type === 'income') income = total;
      else expense = total;
    }

    return { income, expense, net: roundMoney(income - expense), count };
  }

  async getSummary(userId: string, from: CivilDate, to: CivilDate): Promise<TransactionSummary> {
    const { start, end } = this.assertWindow(from, to, 'from', 'to');
    const totals = await this.aggregateByPeriod(userId, start, end);
    return { ...totals, from: start, to: end };
  }

  /**
   * Monthly income/expense/net between two months, inclusive and zero-filled.
   *
   * One grouped query covers the whole range; the caller gets every month back,
   * including the ones with no activity, so a chart never has to guess at a gap.
   * `fromMonth`/`toMonth` accept `YYYY-MM` or any civil date inside the month.
   */
  async monthlyNetSeries(userId: string, fromMonth: string, toMonth: string): Promise<MonthlyNet[]> {
    const first = monthStart(fromMonth, 'fromMonth');
    const last = monthStart(toMonth, 'toMonth');
    if (compareCivilDates(first, last) > 0) return [];

    const groups = await this.prisma.transaction.groupBy({
      by: ['date', 'type'],
      where: { userId, date: inclusiveRange(first, endOfMonth(last)) },
      _sum: { value: true },
    });

    const buckets = new Map<string, { income: number[]; expense: number[] }>();
    for (const group of groups) {
      const key = monthKey(toCivilDate(group.date));
      const bucket = buckets.get(key) ?? { income: [], expense: [] };
      bucket[group.type === 'income' ? 'income' : 'expense'].push(toMoney(group._sum.value));
      buckets.set(key, bucket);
    }

    const series: MonthlyNet[] = [];
    for (let cursor = first; compareCivilDates(cursor, last) <= 0; cursor = addMonths(cursor, 1)) {
      if (series.length >= MAX_SERIES_MONTHS) {
        throw new BadRequestException(`O intervalo não pode passar de ${MAX_SERIES_MONTHS} meses.`);
      }
      const month = monthKey(cursor);
      const bucket = buckets.get(month);
      const income = bucket ? sumMoney(bucket.income) : 0;
      const expense = bucket ? sumMoney(bucket.expense) : 0;
      series.push({ month, income, expense, net: roundMoney(income - expense) });
    }

    return series;
  }

  /**
   * Average monthly expense over the last N **complete** months.
   *
   * The current month is deliberately excluded: on the 2nd of the month it
   * holds one day of spending, and averaging it in halved every projection.
   * Months with no activity count as zero rather than being dropped, and the
   * exact window is reported so the UI can state what it is showing.
   */
  async getProjection(userId: string, months = DEFAULT_PROJECTION_MONTHS): Promise<ExpenseProjection> {
    const span = Math.trunc(months);
    if (!Number.isFinite(span) || span < 1 || span > MAX_PROJECTION_MONTHS) {
      throw new BadRequestException(`months deve estar entre 1 e ${MAX_PROJECTION_MONTHS}.`);
    }

    const today = todayIn(this.timezone());
    const lastCompleteMonth = addMonths(startOfMonth(today), -1);
    const firstMonth = addMonths(lastCompleteMonth, -(span - 1));

    const series = await this.monthlyNetSeries(userId, firstMonth, lastCompleteMonth);

    return {
      projectedMonthlyExpense: roundMoney(sumMoney(series.map((month) => month.expense)) / span),
      basedOnMonths: span,
      window: { from: firstMonth, to: endOfMonth(lastCompleteMonth) },
      months: series,
    };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private timezone(): string {
    return this.config.get('APP_TIMEZONE', { infer: true }) ?? 'America/Sao_Paulo';
  }

  private async list(
    where: Prisma.TransactionWhereInput,
    query: ListTransactionsQueryDto,
  ): Promise<PaginatedResponse<TransactionWithRelations>> {
    const { page, limit, skip } = resolvePagination(query);

    const [rows, totalItems] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: STABLE_ORDER,
        skip,
        take: limit,
        include: WITH_RELATIONS,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return buildPaginatedResponse(rows.map(toTransactionWithRelations), totalItems, page, limit);
  }

  private buildWhere(userId: string, query: ListTransactionsQueryDto): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = { userId };

    if (query.type) where.type = query.type;
    if (query.source) where.source = query.source;
    if (query.accountId) where.accountId = query.accountId;
    if (query.creditCardId) where.creditCardId = query.creditCardId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search?.trim()) where.description = { contains: query.search.trim(), mode: 'insensitive' };

    const date = this.buildDateFilter(query.fromDate, query.toDate);
    if (date) where.date = date;

    return where;
  }

  /**
   * `toDate` is inclusive: the filter is `[from, to + 1 day)`, because a `date`
   * column compared with `lte: '2026-04-30'` still drops nothing but a `lte` on
   * a timestamp would have dropped everything after midnight.
   */
  private buildDateFilter(from?: CivilDate, to?: CivilDate): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;
    if (from && to) {
      const { start, end } = this.assertWindow(from, to, 'fromDate', 'toDate');
      return inclusiveRange(start, end);
    }
    if (from) return { gte: fromCivilDate(parseCivilDate(from, 'fromDate')) };
    return { lt: fromCivilDate(addDays(parseCivilDate(to as CivilDate, 'toDate'), 1)) };
  }

  private assertWindow(
    from: CivilDate,
    to: CivilDate,
    fromField: string,
    toField: string,
  ): { start: CivilDate; end: CivilDate } {
    const start = parseCivilDate(from, fromField);
    const end = parseCivilDate(to, toField);
    if (compareCivilDates(start, end) > 0) {
      throw new BadRequestException('A data inicial não pode ser posterior à data final.');
    }
    return { start, end };
  }
}
