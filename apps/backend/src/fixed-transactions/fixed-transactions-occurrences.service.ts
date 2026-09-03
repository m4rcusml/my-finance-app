import type { OccurrenceStatus, OccurrenceWithTemplate, PaginatedResponse } from '@finance/contracts';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  addDays,
  type CivilDate,
  civilDateOf,
  endOfMonth,
  fromCivilDate,
  inclusiveRange,
  parseCivilDate,
  toCivilDate,
} from '../common/civil-date';
import { toMoney } from '../common/money';
import { assertOwned } from '../common/ownership';
import { buildPaginatedResponse, MAX_PAGE_SIZE, resolvePagination } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { ConfirmOccurrenceDto, ListOccurrencesQueryDto } from './fixed-transactions.dto';
import { type OccurrenceRowWithTemplate, toOccurrenceWithTemplate } from './fixed-transactions.mapper';

/**
 * Everything the contract's `OccurrenceWithTemplate` needs, plus the template's
 * `marginDays` (used to validate the booking window and dropped by the mapper).
 */
const OCCURRENCE_INCLUDE = {
  fixedTransaction: { select: { id: true, description: true, referenceDay: true, marginDays: true } },
  category: { select: { id: true, name: true, type: true } },
} as const;

const NOT_FOUND_LABEL = 'Registro de recorrência';

/**
 * The occurrence lifecycle.
 *
 * `pending -> confirmed` and `pending -> skipped` are the only legal edges;
 * every other move is a 409.
 *
 * Confirming is the one composite write here, and the statement order is
 * dictated by two non-deferrable constraints that PostgreSQL evaluates at the
 * end of each *statement*, not at COMMIT:
 *
 *  - `fixed_transaction_occurrences_confirmed_has_transaction` forbids a row
 *    from being `confirmed` while `transaction_id`/`real_date` are still null,
 *    so the status cannot be flipped before the transaction exists;
 *  - `fixed_transaction_occurrences_transaction_id_fkey` forbids pointing at a
 *    transaction row that has not been inserted yet.
 *
 * Together they leave exactly one legal order:
 *
 *  1. insert the transaction (provisional — it only survives a winning claim);
 *  2. claim the occurrence with a single conditional `updateMany` that moves
 *     `status`, `realDate`, `value` and `transactionId` **together**;
 *     `status: 'pending'` in the WHERE is what arbitrates, so a concurrent
 *     second confirm gets `count === 0` and a 409;
 *  3. read the row back for the response.
 *
 * All of it runs inside one `prisma.$transaction`, so the loser's rollback
 * takes its provisional transaction with it and no orphan is ever committed —
 * exactly one transaction per period, under retry and under concurrency. The
 * UNIQUE index on `transaction_id` is the last line of defence.
 */
@Injectable()
export class FixedTransactionsOccurrencesService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async list(userId: string, query: ListOccurrencesQueryDto): Promise<PaginatedResponse<OccurrenceWithTemplate>> {
    const { page, limit, skip } = resolvePagination(query);
    const where = {
      userId,
      ...(query.year === undefined ? {} : { periodYear: query.year }),
      ...(query.month === undefined ? {} : { periodMonth: query.month }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.fixedTransactionId === undefined ? {} : { fixedTransactionId: query.fixedTransactionId }),
    };

    const [rows, totalItems] = await Promise.all([
      this.prisma.fixedTransactionOccurrence.findMany({
        where,
        include: OCCURRENCE_INCLUDE,
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { dueDate: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.fixedTransactionOccurrence.count({ where }),
    ]);

    return buildPaginatedResponse(rows.map(toOccurrenceWithTemplate), totalItems, page, limit);
  }

  async findOne(userId: string, id: string): Promise<OccurrenceWithTemplate> {
    return toOccurrenceWithTemplate(await this.loadOwned(userId, id));
  }

  /**
   * Pending occurrences whose nominal due day falls inside `[from, to]`.
   * Consumed by the dashboard, which needs the newest due first.
   */
  async findPendingForPeriod(
    userId: string,
    from: CivilDate,
    to: CivilDate,
    limit: number,
  ): Promise<OccurrenceWithTemplate[]> {
    const take = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(limit)));
    const rows = await this.prisma.fixedTransactionOccurrence.findMany({
      where: {
        userId,
        status: 'pending',
        dueDate: inclusiveRange(parseCivilDate(from, 'from'), parseCivilDate(to, 'to')),
      },
      include: OCCURRENCE_INCLUDE,
      orderBy: [{ dueDate: 'desc' }, { id: 'asc' }],
      take,
    });

    return rows.map(toOccurrenceWithTemplate);
  }

  // -------------------------------------------------------------------------
  // State machine
  // -------------------------------------------------------------------------

  async confirm(userId: string, id: string, dto: ConfirmOccurrenceDto): Promise<OccurrenceWithTemplate> {
    const occurrence = await this.loadOwned(userId, id);
    this.assertPending(occurrence.status, 'confirmada');

    const dueDate = toCivilDate(occurrence.dueDate);
    const marginDays = occurrence.fixedTransaction.marginDays ?? 0;
    const bookedDate = dto.realDate ? parseCivilDate(dto.realDate, 'realDate') : dueDate;
    this.assertBookedDateWithinWindow(bookedDate, dueDate, marginDays, occurrence.periodYear, occurrence.periodMonth);

    const value = dto.value ?? toMoney(occurrence.value);
    const bookedAt = fromCivilDate(bookedDate);

    const confirmed = await this.prisma.$transaction(async (tx) => {
      // (1) Provisional: this row is only real if the claim below wins. A loser
      //     throws, the surrounding transaction rolls back, and the insert goes
      //     with it — which is why no orphan can ever be committed.
      const created = await tx.transaction.create({
        data: {
          userId,
          type: occurrence.type,
          value,
          date: bookedAt,
          accountId: occurrence.accountId,
          creditCardId: occurrence.creditCardId,
          categoryId: occurrence.categoryId,
          description: occurrence.description,
          source: 'fixed',
        },
        select: { id: true },
      });

      // (2) The claim. `status: 'pending'` in the WHERE makes a concurrent
      //     second confirm lose deterministically; status, realDate and the
      //     link move in one statement because the CHECK constraint requires
      //     them to be consistent the moment the statement ends.
      const claim = await tx.fixedTransactionOccurrence.updateMany({
        where: { id, userId, status: 'pending' },
        data: { status: 'confirmed', realDate: bookedAt, value, transactionId: created.id },
      });
      if (claim.count === 0) {
        throw new ConflictException('Esta ocorrência já foi confirmada ou ignorada por outra requisição.');
      }

      // (3) Read back inside the same transaction for the response.
      return tx.fixedTransactionOccurrence.findFirst({ where: { id, userId }, include: OCCURRENCE_INCLUDE });
    });

    return toOccurrenceWithTemplate(assertOwned(confirmed, userId, NOT_FOUND_LABEL));
  }

  async skip(userId: string, id: string): Promise<OccurrenceWithTemplate> {
    const occurrence = await this.loadOwned(userId, id);
    this.assertPending(occurrence.status, 'ignorada');

    const claim = await this.prisma.fixedTransactionOccurrence.updateMany({
      where: { id, userId, status: 'pending' },
      data: { status: 'skipped' },
    });
    if (claim.count === 0) {
      throw new ConflictException('Esta ocorrência já foi confirmada ou ignorada por outra requisição.');
    }

    return toOccurrenceWithTemplate(await this.loadOwned(userId, id));
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async loadOwned(userId: string, id: string): Promise<OccurrenceRowWithTemplate> {
    const row = await this.prisma.fixedTransactionOccurrence.findFirst({
      where: { id, userId },
      include: OCCURRENCE_INCLUDE,
    });
    return assertOwned(row, userId, NOT_FOUND_LABEL);
  }

  private assertPending(status: OccurrenceStatus, intent: 'confirmada' | 'ignorada'): void {
    if (status === 'pending') return;
    const already = status === 'confirmed' ? 'confirmada' : 'ignorada';
    throw new ConflictException(`Esta ocorrência já foi ${already} e não pode mais ser ${intent}.`);
  }

  /**
   * Where the money is allowed to have moved.
   *
   * With a margin the window is `[dueDate - marginDays, dueDate + marginDays]`;
   * without one the booking must at least stay inside its own competence month,
   * so a confirmation can never land in a period it does not belong to.
   */
  private assertBookedDateWithinWindow(
    bookedDate: CivilDate,
    dueDate: CivilDate,
    marginDays: number,
    periodYear: number,
    periodMonth: number,
  ): void {
    if (marginDays > 0) {
      const from = addDays(dueDate, -marginDays);
      const to = addDays(dueDate, marginDays);
      if (bookedDate < from || bookedDate > to) {
        throw new BadRequestException(
          `realDate deve ficar entre ${from} e ${to} (vencimento ${dueDate} com margem de ${marginDays} dia(s)).`,
        );
      }
      return;
    }

    const monthStart = civilDateOf(periodYear, periodMonth, 1);
    const monthEnd = endOfMonth(monthStart);
    if (bookedDate < monthStart || bookedDate > monthEnd) {
      throw new BadRequestException(
        `realDate deve ficar dentro do mês de competência (${monthStart} a ${monthEnd}).`,
      );
    }
  }
}
