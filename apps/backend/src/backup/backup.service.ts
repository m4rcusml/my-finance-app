import { createHash, randomUUID } from 'node:crypto';
import {
  BACKUP_SCHEMA_VERSION,
  type BackupFile,
  type RestoreMode,
  type RestoreResponse,
  type RestoreResultCounts,
  type TransactionType,
} from '@finance/contracts';
import { Injectable, InternalServerErrorException, Logger, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromCivilDate, toCivilDate, todayIn } from '../common/civil-date';
import { toMoney, toQuantity } from '../common/money';
import type { EnvConfig } from '../config/env';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  EXPORT_PAGE_SIZE,
  EXPORT_TRANSACTION_MAX_WAIT_MS,
  EXPORT_TRANSACTION_TIMEOUT_MS,
  MAX_EXPORT_ROWS_PER_TABLE,
  MAX_RESTORE_ROWS_PER_COLLECTION,
  RESTORE_LOOKUP_CHUNK_SIZE,
  RESTORE_TRANSACTION_MAX_WAIT_MS,
  RESTORE_TRANSACTION_TIMEOUT_MS,
  RESTORE_WRITE_CHUNK_SIZE,
} from './backup.constants';
import { parseBackupFile } from './backup.validation';

type Tx = Prisma.TransactionClient;

/** Page arguments shared by every export reader. */
interface PageArgs {
  take: number;
  skip?: number;
  cursor?: { id: string };
}

function emptyCounts(): RestoreResultCounts {
  return {
    accounts: 0,
    creditCards: 0,
    categories: 0,
    transactions: 0,
    fixedTransactions: 0,
    fixedTransactionOccurrences: 0,
    marketAssets: 0,
    investments: 0,
    goals: 0,
    importedFiles: 0,
  };
}

function batchCount(result: { count: number } | null | undefined): number {
  return result?.count ?? 0;
}

/** Timestamps (audit fields) are instants, so `new Date` is correct here — never for a civil date. */
function instant(value: string): Date {
  return new Date(value);
}

function nullableInstant(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

/**
 * A fresh id derived from `(userId, collection, originalId)`.
 *
 * Used by `replace` so that restoring the same file twice converges to exactly
 * the same rows — ids included — instead of duplicating the account under new
 * uuids each time. The user id is part of the digest, so ids minted for one
 * account can never collide with another's, and a raw id from the payload is
 * still never written.
 */
function deterministicId(userId: string, collection: string, originalId: string): string {
  const digest = createHash('sha256').update(`${userId}\0${collection}\0${originalId}`).digest('hex');
  const variant = ((Number.parseInt(digest.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `${variant}${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join('-');
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  // -------------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------------

  /** `finance-backup-<YYYY-MM-DD>.json`, dated in the configured timezone. */
  exportFileName(): string {
    return `finance-backup-${todayIn(this.config.get('APP_TIMEZONE', { infer: true }))}.json`;
  }

  /**
   * The caller's whole ledger as a versioned `BackupFile`.
   *
   * Every table is read in pages instead of one unbounded `findMany`, and the
   * `user` block carries only `{ email, name }` — never `passwordHash`,
   * `tokenVersion`, refresh tokens or any other credential material.
   */
  async exportBackup(userId: string): Promise<BackupFile> {
    const [
      user,
      accounts,
      creditCards,
      categories,
      transactions,
      fixedTransactions,
      occurrences,
      marketAssets,
      investments,
      goals,
      importedFiles,
      balances,
    ] = await this.prisma.$transaction(
      async (tx) =>
        await Promise.all([
          tx.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
          this.readAllPages('accounts', (args) =>
            tx.account.findMany({ where: { userId }, orderBy: { id: 'asc' }, ...args }),
          ),
          this.readAllPages('creditCards', (args) =>
            tx.creditCard.findMany({ where: { userId }, orderBy: { id: 'asc' }, ...args }),
          ),
          this.readAllPages('categories', (args) =>
            tx.category.findMany({ where: { userId }, orderBy: { id: 'asc' }, ...args }),
          ),
          this.readAllPages('transactions', (args) =>
            tx.transaction.findMany({ where: { userId }, orderBy: { id: 'asc' }, ...args }),
          ),
          this.readAllPages('fixedTransactions', (args) =>
            tx.fixedTransaction.findMany({ where: { userId }, orderBy: { id: 'asc' }, ...args }),
          ),
          this.readAllPages('fixedTransactionOccurrences', (args) =>
            tx.fixedTransactionOccurrence.findMany({ where: { userId }, orderBy: { id: 'asc' }, ...args }),
          ),
          this.readAllPages('marketAssets', (args) =>
            tx.marketAsset.findMany({ where: { userId }, orderBy: { id: 'asc' }, ...args }),
          ),
          this.readAllPages('investments', (args) =>
            tx.investment.findMany({ where: { userId }, orderBy: { id: 'asc' }, ...args }),
          ),
          this.readAllPages('goals', (args) =>
            tx.goal.findMany({ where: { userId }, orderBy: { id: 'asc' }, ...args }),
          ),
          this.readAllPages('importedFiles', (args) =>
            tx.importedFile.findMany({ where: { userId }, orderBy: { id: 'asc' }, ...args }),
          ),
          this.accountBalances(tx, userId),
        ]),
      {
        isolationLevel: 'RepeatableRead',
        maxWait: EXPORT_TRANSACTION_MAX_WAIT_MS,
        timeout: EXPORT_TRANSACTION_TIMEOUT_MS,
      },
    );

    return {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      // Deliberately only these two fields: a backup is not a credential store.
      user: { email: user?.email ?? '', name: user?.name ?? null },
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        institution: account.institution,
        type: account.type,
        initialBalance: toMoney(account.initialBalance),
        balance: toMoney(toMoney(account.initialBalance) + (balances.get(account.id) ?? 0)),
        isActive: account.isActive,
        archivedAt: account.archivedAt ? account.archivedAt.toISOString() : null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      })),
      creditCards: creditCards.map((card) => ({
        id: card.id,
        name: card.name,
        institution: card.institution,
        limitTotal: toMoney(card.limitTotal),
        closingDay: card.closingDay ?? null,
        isActive: card.isActive,
        archivedAt: card.archivedAt ? card.archivedAt.toISOString() : null,
        createdAt: card.createdAt.toISOString(),
        updatedAt: card.updatedAt.toISOString(),
      })),
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        type: category.type,
        color: category.color ?? null,
        isActive: category.isActive,
        archivedAt: category.archivedAt ? category.archivedAt.toISOString() : null,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      })),
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        value: toMoney(transaction.value),
        date: toCivilDate(transaction.date),
        accountId: transaction.accountId ?? null,
        creditCardId: transaction.creditCardId ?? null,
        categoryId: transaction.categoryId ?? null,
        description: transaction.description ?? null,
        source: transaction.source,
        externalId: transaction.externalId ?? null,
        createdAt: transaction.createdAt.toISOString(),
        updatedAt: transaction.updatedAt.toISOString(),
      })),
      fixedTransactions: fixedTransactions.map((fixed) => ({
        id: fixed.id,
        type: fixed.type,
        value: toMoney(fixed.value),
        referenceDay: fixed.referenceDay,
        marginDays: fixed.marginDays,
        accountId: fixed.accountId ?? null,
        creditCardId: fixed.creditCardId ?? null,
        categoryId: fixed.categoryId,
        description: fixed.description ?? null,
        isActive: fixed.isActive,
        archivedAt: fixed.archivedAt ? fixed.archivedAt.toISOString() : null,
        createdAt: fixed.createdAt.toISOString(),
        updatedAt: fixed.updatedAt.toISOString(),
      })),
      // Silently dropped by the previous implementation, which made every
      // restored ledger lose its recurrence history.
      fixedTransactionOccurrences: occurrences.map((occurrence) => ({
        id: occurrence.id,
        fixedTransactionId: occurrence.fixedTransactionId,
        periodYear: occurrence.periodYear,
        periodMonth: occurrence.periodMonth,
        status: occurrence.status,
        realDate: occurrence.realDate ? toCivilDate(occurrence.realDate) : null,
        transactionId: occurrence.transactionId ?? null,
        dueDate: toCivilDate(occurrence.dueDate),
        type: occurrence.type,
        value: toMoney(occurrence.value),
        description: occurrence.description ?? null,
        categoryId: occurrence.categoryId,
        accountId: occurrence.accountId ?? null,
        creditCardId: occurrence.creditCardId ?? null,
        createdAt: occurrence.createdAt.toISOString(),
        updatedAt: occurrence.updatedAt.toISOString(),
      })),
      marketAssets: marketAssets.map((asset) => ({
        id: asset.id,
        symbol: asset.symbol,
        type: asset.type,
        exchange: asset.exchange,
        name: asset.name ?? null,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString(),
      })),
      investments: investments.map((investment) => ({
        id: investment.id,
        marketAssetId: investment.marketAssetId ?? null,
        broker: investment.broker,
        type: investment.type,
        quantity: toQuantity(investment.quantity),
        buyPrice: toMoney(investment.buyPrice),
        investedAmount: toMoney(investment.investedAmount),
        buyDate: toCivilDate(investment.buyDate),
        createdAt: investment.createdAt.toISOString(),
        updatedAt: investment.updatedAt.toISOString(),
      })),
      goals: goals.map((goal) => {
        const targetAmount = toMoney(goal.targetAmount);
        const currentAmount = toMoney(goal.currentAmount);
        return {
          id: goal.id,
          name: goal.name,
          type: goal.type,
          targetAmount,
          currentAmount,
          deadline: goal.deadline ? toCivilDate(goal.deadline) : null,
          relatedCategoryId: goal.relatedCategoryId ?? null,
          relatedAccountId: goal.relatedAccountId ?? null,
          progress:
            targetAmount > 0 ? Math.round(Math.min(1, Math.max(0, currentAmount / targetAmount)) * 1e4) / 1e4 : 0,
          progressSource: 'manual' as const,
          createdAt: goal.createdAt.toISOString(),
          updatedAt: goal.updatedAt.toISOString(),
        };
      }),
      importedFiles: importedFiles.map((file) => ({
        id: file.id,
        origin: file.origin,
        fileName: file.fileName,
        fileType: file.fileType,
        status: file.status,
        importedAt: file.importedAt.toISOString(),
        totalRecords: file.totalRecords,
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
      })),
    };
  }

  /** Keyset pagination over one table; refuses to truncate an oversized export. */
  private async readAllPages<T extends { id: string }>(
    table: string,
    fetch: (args: PageArgs) => Promise<T[]>,
  ): Promise<T[]> {
    const rows: T[] = [];
    let cursor: string | undefined;

    for (;;) {
      const args: PageArgs =
        cursor === undefined ? { take: EXPORT_PAGE_SIZE } : { take: EXPORT_PAGE_SIZE, skip: 1, cursor: { id: cursor } };
      const page = (await fetch(args)) ?? [];
      if (page.length === 0) break;

      rows.push(...page);
      if (rows.length > MAX_EXPORT_ROWS_PER_TABLE) {
        throw new PayloadTooLargeException(
          `Sua conta tem registros demais em "${table}" para exportar em um único arquivo.`,
        );
      }
      if (page.length < EXPORT_PAGE_SIZE) break;
      cursor = page[page.length - 1].id;
    }

    return rows;
  }

  /** `income - expense` booked to each account, in one aggregate rather than per account. */
  private async accountBalances(tx: Tx, userId: string): Promise<Map<string, number>> {
    const grouped = ((await tx.transaction.groupBy({
      by: ['accountId', 'type'],
      where: { userId, accountId: { not: null } },
      _sum: { value: true },
    })) ?? []) as unknown as { accountId: string | null; type: TransactionType; _sum: { value: unknown } }[];

    const cents = new Map<string, number>();
    for (const row of grouped) {
      if (row.accountId === null) continue;
      const signed = Math.round(toMoney(row._sum.value) * 100) * (row.type === 'income' ? 1 : -1);
      cents.set(row.accountId, (cents.get(row.accountId) ?? 0) + signed);
    }

    const balances = new Map<string, number>();
    for (const [accountId, total] of cents) balances.set(accountId, total / 100);
    return balances;
  }

  // -------------------------------------------------------------------------
  // Restore
  // -------------------------------------------------------------------------

  /**
   * Restores a `BackupFile` into the caller's account.
   *
   * The whole operation is one interactive transaction: validation runs first,
   * then (for `replace`) the deletes, then the inserts, then an assertion pass
   * that re-reads the database and proves no restored row points at another
   * user's account. Any failure rolls the entire thing back — there is no
   * half-imported state.
   */
  async restoreBackup(userId: string, mode: RestoreMode, raw: unknown): Promise<RestoreResponse> {
    this.assertPayloadSize(raw);
    const file = parseBackupFile(raw);

    return await this.prisma.$transaction(
      async (tx) => {
        const deleted = mode === 'replace' ? await this.purge(tx, userId) : emptyCounts();
        const created = await this.insert(tx, userId, mode, file);
        await this.assertNoCrossUserReferences(tx, userId);

        this.logger.log({
          message: 'backup restaurado',
          userId,
          mode,
          created,
          deleted,
        });

        return {
          mode,
          schemaVersion: BACKUP_SCHEMA_VERSION,
          created,
          deleted,
        } satisfies RestoreResponse;
      },
      { maxWait: RESTORE_TRANSACTION_MAX_WAIT_MS, timeout: RESTORE_TRANSACTION_TIMEOUT_MS },
    );
  }

  private assertPayloadSize(raw: unknown): void {
    const limit = this.config.get('MAX_BACKUP_BYTES', { infer: true });
    let bytes: number;
    try {
      bytes = Buffer.byteLength(JSON.stringify(raw ?? null), 'utf8');
    } catch {
      throw new PayloadTooLargeException('Não foi possível ler o arquivo de backup enviado.');
    }
    if (bytes > limit) {
      throw new PayloadTooLargeException(
        `O backup enviado tem ${Math.ceil(bytes / 1024)} KB e excede o limite de ${Math.floor(limit / 1024)} KB.`,
      );
    }
  }

  /**
   * Deletes the caller's rows in FK-safe order. Import batches and their rows
   * go too: they are scratch state for an upload that no longer has a ledger.
   */
  private async purge(tx: Tx, userId: string): Promise<RestoreResultCounts> {
    const fixedTransactionOccurrences = batchCount(
      await tx.fixedTransactionOccurrence.deleteMany({ where: { userId } }),
    );
    const transactions = batchCount(await tx.transaction.deleteMany({ where: { userId } }));
    const fixedTransactions = batchCount(await tx.fixedTransaction.deleteMany({ where: { userId } }));
    await tx.importBatchRow.deleteMany({ where: { batch: { userId } } });
    const importedFiles = batchCount(await tx.importedFile.deleteMany({ where: { userId } }));
    await tx.importBatch.deleteMany({ where: { userId } });
    const investments = batchCount(await tx.investment.deleteMany({ where: { userId } }));
    const goals = batchCount(await tx.goal.deleteMany({ where: { userId } }));
    const marketAssets = batchCount(await tx.marketAsset.deleteMany({ where: { userId } }));
    const categories = batchCount(await tx.category.deleteMany({ where: { userId } }));
    const creditCards = batchCount(await tx.creditCard.deleteMany({ where: { userId } }));
    const accounts = batchCount(await tx.account.deleteMany({ where: { userId } }));

    return {
      accounts,
      creditCards,
      categories,
      transactions,
      fixedTransactions,
      fixedTransactionOccurrences,
      marketAssets,
      investments,
      goals,
      importedFiles,
    };
  }

  private async insert(tx: Tx, userId: string, mode: RestoreMode, file: BackupFile): Promise<RestoreResultCounts> {
    const created = emptyCounts();

    const accountIds = this.newIds(mode, userId, 'accounts', file.accounts);
    const creditCardIds = this.newIds(mode, userId, 'creditCards', file.creditCards);
    const fixedIds = this.newIds(mode, userId, 'fixedTransactions', file.fixedTransactions);
    const occurrenceIds = this.newIds(mode, userId, 'fixedTransactionOccurrences', file.fixedTransactionOccurrences);
    const investmentIds = this.newIds(mode, userId, 'investments', file.investments);
    const goalIds = this.newIds(mode, userId, 'goals', file.goals);
    const importedFileIds = this.newIds(mode, userId, 'importedFiles', file.importedFiles);

    // Categories and market assets carry natural unique keys per user, so a
    // merge reuses whatever already matches instead of exploding on P2002.
    const categories = await this.reconcile(
      mode,
      userId,
      'categories',
      file.categories,
      (category) => `${category.name}\0${category.type}`,
      async () =>
        (await tx.category.findMany({
          where: { userId },
          select: { id: true, name: true, type: true },
          take: MAX_RESTORE_ROWS_PER_COLLECTION,
        })) ?? [],
      (existing) => `${existing.name}\0${existing.type}`,
    );
    const marketAssets = await this.reconcile(
      mode,
      userId,
      'marketAssets',
      file.marketAssets,
      (asset) => `${asset.symbol}\0${asset.exchange}`,
      async () =>
        (await tx.marketAsset.findMany({
          where: { userId },
          select: { id: true, symbol: true, exchange: true },
          take: MAX_RESTORE_ROWS_PER_COLLECTION,
        })) ?? [],
      (existing) => `${existing.symbol}\0${existing.exchange}`,
    );

    // A merge never re-imports a bank row the ledger already carries.
    const existingTransactions =
      mode === 'merge'
        ? await this.existingTransactionsByExternalId(
            tx,
            userId,
            file.transactions.map((transaction) => transaction.externalId).filter((id): id is string => id !== null),
          )
        : new Map<string, string>();
    const transactions = file.transactions.filter(
      (transaction) => transaction.externalId === null || !existingTransactions.has(transaction.externalId),
    );
    const transactionIds = this.newIds(mode, userId, 'transactions', transactions);
    for (const transaction of file.transactions) {
      if (transaction.externalId === null) continue;
      const existingId = existingTransactions.get(transaction.externalId);
      if (existingId !== undefined) transactionIds.set(transaction.id, existingId);
    }

    created.accounts = await this.writeChunks(file.accounts, (chunk) =>
      tx.account.createMany({
        data: chunk.map((account) => ({
          id: mapRequired(accountIds, account.id),
          userId,
          name: account.name,
          institution: account.institution,
          type: account.type,
          initialBalance: account.initialBalance,
          isActive: account.isActive,
          archivedAt: nullableInstant(account.archivedAt),
          createdAt: instant(account.createdAt),
          updatedAt: instant(account.updatedAt),
        })),
      }),
    );

    created.creditCards = await this.writeChunks(file.creditCards, (chunk) =>
      tx.creditCard.createMany({
        data: chunk.map((card) => ({
          id: mapRequired(creditCardIds, card.id),
          userId,
          name: card.name,
          institution: card.institution,
          limitTotal: card.limitTotal,
          closingDay: card.closingDay,
          isActive: card.isActive,
          archivedAt: nullableInstant(card.archivedAt),
          createdAt: instant(card.createdAt),
          updatedAt: instant(card.updatedAt),
        })),
      }),
    );

    created.categories = await this.writeChunks(categories.toCreate, (chunk) =>
      tx.category.createMany({
        data: chunk.map((category) => ({
          id: mapRequired(categories.map, category.id),
          userId,
          name: category.name,
          type: category.type,
          color: category.color ?? null,
          isActive: category.isActive,
          archivedAt: nullableInstant(category.archivedAt),
          createdAt: instant(category.createdAt),
          updatedAt: instant(category.updatedAt),
        })),
      }),
    );

    created.marketAssets = await this.writeChunks(marketAssets.toCreate, (chunk) =>
      tx.marketAsset.createMany({
        data: chunk.map((asset) => ({
          id: mapRequired(marketAssets.map, asset.id),
          userId,
          symbol: asset.symbol,
          type: asset.type,
          exchange: asset.exchange,
          name: asset.name,
          createdAt: instant(asset.createdAt),
          updatedAt: instant(asset.updatedAt),
        })),
      }),
    );

    created.transactions = await this.writeChunks(transactions, (chunk) =>
      tx.transaction.createMany({
        data: chunk.map((transaction) => ({
          id: mapRequired(transactionIds, transaction.id),
          userId,
          type: transaction.type,
          value: transaction.value,
          date: fromCivilDate(transaction.date),
          accountId: mapOptional(accountIds, transaction.accountId),
          creditCardId: mapOptional(creditCardIds, transaction.creditCardId),
          categoryId: mapOptional(categories.map, transaction.categoryId),
          description: transaction.description,
          source: transaction.source,
          externalId: transaction.externalId,
          // Import batches are scratch state and are never part of a backup.
          importBatchId: null,
          createdAt: instant(transaction.createdAt),
          updatedAt: instant(transaction.updatedAt),
        })),
      }),
    );

    created.fixedTransactions = await this.writeChunks(file.fixedTransactions, (chunk) =>
      tx.fixedTransaction.createMany({
        data: chunk.map((fixed) => ({
          id: mapRequired(fixedIds, fixed.id),
          userId,
          type: fixed.type,
          value: fixed.value,
          referenceDay: fixed.referenceDay,
          marginDays: fixed.marginDays,
          accountId: mapOptional(accountIds, fixed.accountId),
          creditCardId: mapOptional(creditCardIds, fixed.creditCardId),
          categoryId: mapRequired(categories.map, fixed.categoryId),
          description: fixed.description,
          isActive: fixed.isActive,
          archivedAt: nullableInstant(fixed.archivedAt),
          createdAt: instant(fixed.createdAt),
          updatedAt: instant(fixed.updatedAt),
        })),
      }),
    );

    const referencedTransactionIds = file.fixedTransactionOccurrences.flatMap((occurrence) =>
      occurrence.transactionId === null ? [] : [mapRequired(transactionIds, occurrence.transactionId)],
    );
    const claimedTransactionIds =
      mode === 'merge'
        ? await this.existingOccurrenceTransactionIds(tx, userId, referencedTransactionIds)
        : new Set<string>();
    const occurrences = file.fixedTransactionOccurrences.filter((occurrence) => {
      if (occurrence.transactionId === null) return true;
      const transactionId = mapRequired(transactionIds, occurrence.transactionId);
      if (claimedTransactionIds.has(transactionId)) return false;
      claimedTransactionIds.add(transactionId);
      return true;
    });

    created.fixedTransactionOccurrences = await this.writeChunks(occurrences, (chunk) =>
      tx.fixedTransactionOccurrence.createMany({
        data: chunk.map((occurrence) => ({
          id: mapRequired(occurrenceIds, occurrence.id),
          userId,
          fixedTransactionId: mapRequired(fixedIds, occurrence.fixedTransactionId),
          periodYear: occurrence.periodYear,
          periodMonth: occurrence.periodMonth,
          status: occurrence.status,
          realDate: occurrence.realDate === null ? null : fromCivilDate(occurrence.realDate),
          dueDate: fromCivilDate(occurrence.dueDate),
          transactionId: mapOptional(transactionIds, occurrence.transactionId),
          type: occurrence.type,
          value: occurrence.value,
          description: occurrence.description,
          categoryId: mapRequired(categories.map, occurrence.categoryId),
          accountId: mapOptional(accountIds, occurrence.accountId),
          creditCardId: mapOptional(creditCardIds, occurrence.creditCardId),
          createdAt: instant(occurrence.createdAt),
          updatedAt: instant(occurrence.updatedAt),
        })),
      }),
    );

    created.investments = await this.writeChunks(file.investments, (chunk) =>
      tx.investment.createMany({
        data: chunk.map((investment) => ({
          id: mapRequired(investmentIds, investment.id),
          userId,
          marketAssetId: mapOptional(marketAssets.map, investment.marketAssetId),
          broker: investment.broker,
          type: investment.type,
          quantity: investment.quantity,
          buyPrice: investment.buyPrice,
          investedAmount: investment.investedAmount,
          buyDate: fromCivilDate(investment.buyDate),
          createdAt: instant(investment.createdAt),
          updatedAt: instant(investment.updatedAt),
        })),
      }),
    );

    created.goals = await this.writeChunks(file.goals, (chunk) =>
      tx.goal.createMany({
        data: chunk.map((goal) => ({
          id: mapRequired(goalIds, goal.id),
          userId,
          name: goal.name,
          type: goal.type,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          deadline: goal.deadline === null ? null : fromCivilDate(goal.deadline),
          relatedCategoryId: mapOptional(categories.map, goal.relatedCategoryId),
          relatedAccountId: mapOptional(accountIds, goal.relatedAccountId),
          createdAt: instant(goal.createdAt),
          updatedAt: instant(goal.updatedAt),
        })),
      }),
    );

    created.importedFiles = await this.writeChunks(file.importedFiles, (chunk) =>
      tx.importedFile.createMany({
        data: chunk.map((imported) => ({
          id: mapRequired(importedFileIds, imported.id),
          userId,
          // The batch itself is transient upload state and is not exported.
          batchId: null,
          origin: imported.origin,
          fileName: imported.fileName,
          fileType: imported.fileType,
          status: imported.status,
          importedAt: instant(imported.importedAt),
          totalRecords: imported.totalRecords,
          createdAt: instant(imported.createdAt),
          updatedAt: instant(imported.updatedAt),
        })),
      }),
    );

    const skipped = file.transactions.length - transactions.length;
    if (skipped > 0) {
      this.logger.log({ message: 'transações ignoradas por externalId já existente', userId, skipped });
    }

    return created;
  }

  /** Fresh ids for a whole collection: deterministic for `replace`, random for `merge`. */
  private newIds(mode: RestoreMode, userId: string, collection: string, rows: { id: string }[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.id, mode === 'replace' ? deterministicId(userId, collection, row.id) : randomUUID());
    }
    return map;
  }

  /**
   * Builds the id map for a collection with a per-user unique natural key. In
   * `merge` mode an incoming row that matches an existing one maps onto it and
   * is not re-created; in `replace` mode everything is created fresh.
   */
  private async reconcile<T extends { id: string }, E extends { id: string }>(
    mode: RestoreMode,
    userId: string,
    collection: string,
    rows: T[],
    keyOf: (row: T) => string,
    loadExisting: () => Promise<E[]>,
    existingKeyOf: (row: E) => string,
  ): Promise<{ map: Map<string, string>; toCreate: T[] }> {
    const map = new Map<string, string>();
    const toCreate: T[] = [];

    if (mode !== 'merge') {
      for (const row of rows) {
        map.set(row.id, deterministicId(userId, collection, row.id));
        toCreate.push(row);
      }
      return { map, toCreate };
    }

    const byKey = new Map<string, string>();
    if (rows.length > 0) {
      for (const existing of await loadExisting()) byKey.set(existingKeyOf(existing), existing.id);
    }

    for (const row of rows) {
      const key = keyOf(row);
      const hit = byKey.get(key);
      if (hit !== undefined) {
        map.set(row.id, hit);
        continue;
      }
      const fresh = randomUUID();
      map.set(row.id, fresh);
      byKey.set(key, fresh);
      toCreate.push(row);
    }

    return { map, toCreate };
  }

  private async existingTransactionsByExternalId(
    tx: Tx,
    userId: string,
    externalIds: string[],
  ): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    for (let i = 0; i < externalIds.length; i += RESTORE_LOOKUP_CHUNK_SIZE) {
      const chunk = externalIds.slice(i, i + RESTORE_LOOKUP_CHUNK_SIZE);
      const rows =
        (await tx.transaction.findMany({
          where: { userId, externalId: { in: chunk } },
          select: { id: true, externalId: true },
          take: chunk.length,
        })) ?? [];
      for (const row of rows) {
        if (row.externalId !== null) found.set(row.externalId, row.id);
      }
    }
    return found;
  }

  private async existingOccurrenceTransactionIds(
    tx: Tx,
    userId: string,
    transactionIds: string[],
  ): Promise<Set<string>> {
    const found = new Set<string>();
    for (let i = 0; i < transactionIds.length; i += RESTORE_LOOKUP_CHUNK_SIZE) {
      const chunk = transactionIds.slice(i, i + RESTORE_LOOKUP_CHUNK_SIZE);
      const rows =
        (await tx.fixedTransactionOccurrence.findMany({
          where: { userId, transactionId: { in: chunk } },
          select: { transactionId: true },
          take: chunk.length,
        })) ?? [];
      for (const row of rows) {
        if (row.transactionId !== null) found.add(row.transactionId);
      }
    }
    return found;
  }

  private async writeChunks<T>(rows: T[], write: (chunk: T[]) => Promise<unknown>): Promise<number> {
    for (let i = 0; i < rows.length; i += RESTORE_WRITE_CHUNK_SIZE) {
      await write(rows.slice(i, i + RESTORE_WRITE_CHUNK_SIZE));
    }
    return rows.length;
  }

  /**
   * Re-reads what was just written and proves that no restored row references a
   * parent belonging to somebody else. Remapping makes this impossible by
   * construction; this pass is the seatbelt that turns a future regression into
   * a rolled-back transaction instead of silent cross-tenant data.
   */
  private async assertNoCrossUserReferences(tx: Tx, userId: string): Promise<void> {
    const foreign = { not: userId };

    const counts = await Promise.all([
      tx.transaction.count({
        where: {
          userId,
          OR: [
            { account: { is: { userId: foreign } } },
            { creditCard: { is: { userId: foreign } } },
            { category: { is: { userId: foreign } } },
          ],
        },
      }),
      tx.fixedTransaction.count({
        where: {
          userId,
          OR: [
            { account: { is: { userId: foreign } } },
            { creditCard: { is: { userId: foreign } } },
            { category: { userId: foreign } },
          ],
        },
      }),
      tx.fixedTransactionOccurrence.count({
        where: {
          userId,
          OR: [
            { account: { is: { userId: foreign } } },
            { creditCard: { is: { userId: foreign } } },
            { category: { userId: foreign } },
            { fixedTransaction: { userId: foreign } },
            { transaction: { is: { userId: foreign } } },
          ],
        },
      }),
      tx.investment.count({
        where: {
          userId,
          marketAsset: { is: { OR: [{ userId: null }, { userId: foreign }] } },
        },
      }),
      tx.goal.count({
        where: {
          userId,
          OR: [{ relatedAccount: { is: { userId: foreign } } }, { relatedCategory: { is: { userId: foreign } } }],
        },
      }),
    ]);

    const offending = counts.reduce((total, count) => total + (count ?? 0), 0);
    if (offending > 0) {
      // Rolls the whole restore back; the filter turns this into a generic 500.
      throw new InternalServerErrorException('Falha de integridade ao restaurar o backup.');
    }
  }
}

/**
 * Resolves a payload id through the remap. A miss is impossible after
 * validation, so it means a bug — and the one thing we must never do is fall
 * back to the raw id from the payload.
 */
function mapRequired(map: Map<string, string>, id: string): string {
  const mapped = map.get(id);
  if (mapped === undefined) {
    throw new InternalServerErrorException('Não foi possível resolver uma referência do backup.');
  }
  return mapped;
}

function mapOptional(map: Map<string, string>, id: string | null): string | null {
  return id === null ? null : mapRequired(map, id);
}
