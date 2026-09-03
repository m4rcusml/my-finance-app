import {
  type Account,
  buildPaginatedResponse,
  INVESTMENT_ACCOUNT_TYPES,
  type PaginatedResponse,
} from '@finance/contracts';
import { Injectable } from '@nestjs/common';
import { sumMoney, toMoney } from '../common/money';
import { assertOwned } from '../common/ownership';
import { resolvePagination } from '../common/pagination.dto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAccountDto, ListAccountsQueryDto, UpdateAccountDto } from './accounts.dto';

/** The columns a response is built from — never the joined `transactions`. */
type AccountRow = {
  id: string;
  userId: string;
  name: string;
  institution: string;
  type: Account['type'];
  initialBalance: unknown;
  isActive: boolean;
  archivedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const NOT_FOUND = 'Conta';

function toIso(value: Date | string): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  return value === null || value === undefined ? null : toIso(value);
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async findAll(userId: string, query: ListAccountsQueryDto = {}): Promise<PaginatedResponse<Account>> {
    const { page, limit, skip } = resolvePagination(query);
    const where = { userId, ...(query.includeArchived === true ? {} : { isActive: true }) };

    const [rows, totalItems] = await Promise.all([
      this.prisma.account.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.account.count({ where }),
    ]);

    // One extra query for the whole page, regardless of how many transactions exist.
    const deltas = await this.balanceDeltas(
      userId,
      rows.map((row) => row.id),
    );

    const data = rows.map((row) => this.toResource(row as AccountRow, deltas.get(row.id) ?? 0));
    return buildPaginatedResponse(data, totalItems, page, limit);
  }

  async findOne(userId: string, accountId: string): Promise<Account> {
    const row = assertOwned(await this.prisma.account.findUnique({ where: { id: accountId } }), userId, NOT_FOUND);
    return await this.withBalance(userId, row as AccountRow);
  }

  /**
   * Dashboard helper: spendable cash versus money parked in investment
   * accounts. Computed by the database in a single statement — the balance of
   * every account is folded in SQL, so this never depends on how much history
   * the user has.
   */
  async getBalancesByType(userId: string): Promise<{ cashBalance: number; investmentBalance: number }> {
    const investmentTypes = Prisma.join(INVESTMENT_ACCOUNT_TYPES.map((type) => Prisma.sql`${type}`));

    const rows = await this.prisma.$queryRaw<{ cashBalance: unknown; investmentBalance: unknown }[]>`
      SELECT
        COALESCE(SUM(b.balance) FILTER (WHERE b.type::text NOT IN (${investmentTypes})), 0)::text AS "cashBalance",
        COALESCE(SUM(b.balance) FILTER (WHERE b.type::text IN (${investmentTypes})), 0)::text AS "investmentBalance"
      FROM (
        SELECT
          a.id,
          a.type,
          a.initial_balance
            + COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.value ELSE -t.value END), 0) AS balance
        FROM accounts a
        LEFT JOIN transactions t ON t.account_id = a.id AND t.user_id = a.user_id
        WHERE a.user_id = ${userId} AND a.is_active = true
        GROUP BY a.id, a.type, a.initial_balance
      ) b
    `;

    const row = rows[0];
    return {
      cashBalance: toMoney(row?.cashBalance),
      investmentBalance: toMoney(row?.investmentBalance),
    };
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  async create(userId: string, dto: CreateAccountDto): Promise<Account> {
    const row = await this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        institution: dto.institution,
        type: dto.type,
        initialBalance: dto.initialBalance,
      },
    });
    // A brand-new account has no transactions, so its balance is the opening one.
    return this.toResource(row as AccountRow, 0);
  }

  async update(userId: string, accountId: string, dto: UpdateAccountDto): Promise<Account> {
    assertOwned(await this.prisma.account.findUnique({ where: { id: accountId } }), userId, NOT_FOUND);

    const row = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.institution !== undefined ? { institution: dto.institution } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.initialBalance !== undefined ? { initialBalance: dto.initialBalance } : {}),
      },
    });

    return await this.withBalance(userId, row as AccountRow);
  }

  /**
   * Archive-or-delete. History is never destroyed: an account referenced by a
   * transaction, lançamento fixo, ocorrência or meta is archived; only a fully
   * unreferenced account is actually removed.
   */
  async remove(userId: string, accountId: string): Promise<Account> {
    const existing = assertOwned(await this.prisma.account.findUnique({ where: { id: accountId } }), userId, NOT_FOUND);

    const row = await this.prisma.$transaction(async (tx) => {
      const dependents = await this.countDependents(tx, userId, accountId);
      if (dependents === 0) {
        await tx.account.delete({ where: { id: accountId } });
        return existing;
      }
      if (!existing.isActive) return existing;
      return await tx.account.update({
        where: { id: accountId },
        data: { isActive: false, archivedAt: new Date() },
      });
    });

    return await this.withBalance(userId, row as AccountRow);
  }

  async archive(userId: string, accountId: string): Promise<Account> {
    const existing = assertOwned(await this.prisma.account.findUnique({ where: { id: accountId } }), userId, NOT_FOUND);
    if (!existing.isActive) return await this.withBalance(userId, existing as AccountRow);

    const row = await this.prisma.account.update({
      where: { id: accountId },
      data: { isActive: false, archivedAt: new Date() },
    });
    return await this.withBalance(userId, row as AccountRow);
  }

  async restore(userId: string, accountId: string): Promise<Account> {
    const existing = assertOwned(await this.prisma.account.findUnique({ where: { id: accountId } }), userId, NOT_FOUND);
    if (existing.isActive) return await this.withBalance(userId, existing as AccountRow);

    const row = await this.prisma.account.update({
      where: { id: accountId },
      data: { isActive: true, archivedAt: null },
    });
    return await this.withBalance(userId, row as AccountRow);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * `income - expense` per account, aggregated by PostgreSQL. One query for the
   * whole page: the old implementation loaded every transaction of every
   * account into memory just to add them up.
   */
  private async balanceDeltas(userId: string, accountIds: string[]): Promise<Map<string, number>> {
    const deltas = new Map<string, number>();
    if (accountIds.length === 0) return deltas;

    const grouped = await this.prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: { userId, accountId: { in: accountIds } },
      _sum: { value: true },
    });

    for (const group of grouped) {
      const accountId = group.accountId;
      if (!accountId) continue;
      const amount = toMoney(group._sum?.value);
      const signed = group.type === 'income' ? amount : -amount;
      deltas.set(accountId, sumMoney([deltas.get(accountId) ?? 0, signed]));
    }

    return deltas;
  }

  private async withBalance(userId: string, row: AccountRow): Promise<Account> {
    const deltas = await this.balanceDeltas(userId, [row.id]);
    return this.toResource(row, deltas.get(row.id) ?? 0);
  }

  private toResource(row: AccountRow, delta: number): Account {
    const initialBalance = toMoney(row.initialBalance);
    return {
      id: row.id,
      name: row.name,
      institution: row.institution,
      type: row.type,
      initialBalance,
      balance: sumMoney([initialBalance, delta]),
      isActive: row.isActive,
      archivedAt: toIsoOrNull(row.archivedAt),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  /** Everything that would lose its history if the row disappeared. */
  private async countDependents(tx: Prisma.TransactionClient, userId: string, accountId: string): Promise<number> {
    const [transactions, fixedTransactions, occurrences, goals] = await Promise.all([
      tx.transaction.count({ where: { userId, accountId } }),
      tx.fixedTransaction.count({ where: { userId, accountId } }),
      tx.fixedTransactionOccurrence.count({ where: { userId, accountId } }),
      tx.goal.count({ where: { userId, relatedAccountId: accountId } }),
    ]);
    return transactions + fixedTransactions + occurrences + goals;
  }
}
