import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BackupData } from './backup.dto';

@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaService) {}

  async export(userId: string): Promise<BackupData> {
    const [
      accounts,
      categories,
      creditCards,
      marketAssets,
      transactions,
      fixedTransactions,
      investments,
      goals,
      importedFiles,
      user,
    ] = await Promise.all([
      this.prisma.account.findMany({ where: { userId } }),
      this.prisma.category.findMany({ where: { userId } }),
      this.prisma.creditCard.findMany({ where: { userId } }),
      this.prisma.marketAsset.findMany({ where: { userId } }),
      this.prisma.transaction.findMany({ where: { userId } }),
      this.prisma.fixedTransaction.findMany({ where: { userId } }),
      this.prisma.investment.findMany({ where: { userId } }),
      this.prisma.goal.findMany({ where: { userId } }),
      this.prisma.importedFile.findMany({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: {
        id: userId,
        email: user?.email ?? '',
        name: user?.name,
      },
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        institution: a.institution,
        type: a.type,
        initialBalance: Number(a.initialBalance),
        isActive: a.isActive,
      })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      })),
      creditCards: creditCards.map((c) => ({
        id: c.id,
        name: c.name,
        institution: c.institution,
        limitTotal: Number(c.limitTotal),
        closingDay: c.closingDay ?? undefined,
        isActive: c.isActive,
      })),
      marketAssets: marketAssets.map((m) => ({
        id: m.id,
        symbol: m.symbol,
        type: m.type,
        exchange: m.exchange,
        name: m.name ?? undefined,
      })),
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        value: Number(t.value),
        date: t.date.toISOString(),
        accountId: t.accountId ?? undefined,
        creditCardId: t.creditCardId ?? undefined,
        categoryId: t.categoryId ?? undefined,
        description: t.description ?? undefined,
        source: t.source,
        externalId: t.externalId ?? undefined,
      })),
      fixedTransactions: fixedTransactions.map((f) => ({
        id: f.id,
        type: f.type,
        value: Number(f.value),
        referenceDay: f.referenceDay,
        marginDays: f.marginDays,
        accountId: f.accountId ?? undefined,
        creditCardId: f.creditCardId ?? undefined,
        categoryId: f.categoryId,
        description: f.description ?? undefined,
        isActive: f.isActive,
      })),
      investments: investments.map((i) => ({
        id: i.id,
        marketAssetId: i.marketAssetId ?? undefined,
        broker: i.broker,
        type: i.type,
        quantity: Number(i.quantity),
        buyPrice: Number(i.buyPrice),
        investedAmount: Number(i.investedAmount),
        buyDate: i.buyDate.toISOString(),
      })),
      goals: goals.map((g) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        targetAmount: Number(g.targetAmount),
        currentAmount: g.currentAmount ? Number(g.currentAmount) : undefined,
        deadline: g.deadline ? g.deadline.toISOString() : undefined,
        relatedCategoryId: g.relatedCategoryId ?? undefined,
        relatedAccountId: g.relatedAccountId ?? undefined,
      })),
      importedFiles: importedFiles.map((f) => ({
        id: f.id,
        origin: f.origin,
        fileName: f.fileName,
        fileType: f.fileType,
        status: f.status,
        importedAt: f.importedAt.toISOString(),
        totalRecords: f.totalRecords,
      })),
    };
  }

  async restore(userId: string, data: BackupData) {
    this.validateBackupData(data);

    const accountIdMap = await this.createWithIdMap(data.accounts, (record) =>
      this.prisma.account.create({
        data: {
          userId,
          name: record.name,
          institution: record.institution,
          type: record.type,
          initialBalance: record.initialBalance,
          isActive: record.isActive,
        },
        select: { id: true },
      }),
    );

    const categoryIdMap = await this.createWithIdMap(data.categories, (record) =>
      this.prisma.category.create({
        data: {
          userId,
          name: record.name,
          type: record.type,
        },
        select: { id: true },
      }),
    );

    const creditCardIdMap = await this.createWithIdMap(data.creditCards, (record) =>
      this.prisma.creditCard.create({
        data: {
          userId,
          name: record.name,
          institution: record.institution,
          limitTotal: record.limitTotal,
          closingDay: record.closingDay,
          isActive: record.isActive,
        },
        select: { id: true },
      }),
    );

    const marketAssetIdMap = await this.createWithIdMap(data.marketAssets, (record) =>
      this.prisma.marketAsset.create({
        data: {
          userId,
          symbol: record.symbol,
          type: record.type,
          exchange: record.exchange,
          name: record.name,
        },
        select: { id: true },
      }),
    );

    await Promise.all(
      data.transactions.map((t) =>
        this.prisma.transaction.create({
          data: {
            userId,
            type: t.type,
            value: t.value,
            date: new Date(t.date),
            accountId: t.accountId ? accountIdMap.get(t.accountId) : null,
            creditCardId: t.creditCardId ? creditCardIdMap.get(t.creditCardId) : null,
            categoryId: t.categoryId ? categoryIdMap.get(t.categoryId) : null,
            description: t.description,
            source: t.source,
            externalId: t.externalId,
          },
        }),
      ),
    );

    await Promise.all(
      data.fixedTransactions.map((f) =>
        this.prisma.fixedTransaction.create({
          data: {
            userId,
            type: f.type,
            value: f.value,
            referenceDay: f.referenceDay,
            marginDays: f.marginDays,
            accountId: f.accountId ? accountIdMap.get(f.accountId) : null,
            creditCardId: f.creditCardId ? creditCardIdMap.get(f.creditCardId) : null,
            categoryId: categoryIdMap.get(f.categoryId) || f.categoryId,
            description: f.description,
            isActive: f.isActive,
          },
        }),
      ),
    );

    await Promise.all(
      data.investments.map((i) =>
        this.prisma.investment.create({
          data: {
            userId,
            marketAssetId: i.marketAssetId ? marketAssetIdMap.get(i.marketAssetId) : null,
            broker: i.broker,
            type: i.type,
            quantity: i.quantity,
            buyPrice: i.buyPrice,
            investedAmount: i.investedAmount,
            buyDate: new Date(i.buyDate),
          },
        }),
      ),
    );

    await Promise.all(
      data.goals.map((g) =>
        this.prisma.goal.create({
          data: {
            userId,
            name: g.name,
            type: g.type,
            targetAmount: g.targetAmount,
            currentAmount: g.currentAmount,
            deadline: g.deadline ? new Date(g.deadline) : null,
            relatedCategoryId: g.relatedCategoryId ? categoryIdMap.get(g.relatedCategoryId) : null,
            relatedAccountId: g.relatedAccountId ? accountIdMap.get(g.relatedAccountId) : null,
          },
        }),
      ),
    );

    await Promise.all(
      data.importedFiles.map((f) =>
        this.prisma.importedFile.create({
          data: {
            userId,
            origin: f.origin,
            fileName: f.fileName,
            fileType: f.fileType,
            status: f.status,
            importedAt: new Date(f.importedAt),
            totalRecords: f.totalRecords,
          },
        }),
      ),
    );

    return {
      restored: {
        accounts: data.accounts.length,
        categories: data.categories.length,
        creditCards: data.creditCards.length,
        marketAssets: data.marketAssets.length,
        transactions: data.transactions.length,
        fixedTransactions: data.fixedTransactions.length,
        investments: data.investments.length,
        goals: data.goals.length,
        importedFiles: data.importedFiles.length,
      },
    };
  }

  private validateBackupData(data: unknown): asserts data is BackupData {
    if (!data || typeof data !== 'object') {
      throw new BadRequestException('Invalid backup data: expected an object');
    }

    const d = data as Record<string, unknown>;

    const requiredArrays = [
      'accounts',
      'categories',
      'creditCards',
      'marketAssets',
      'transactions',
      'fixedTransactions',
      'investments',
      'goals',
      'importedFiles',
    ];

    for (const key of requiredArrays) {
      if (!Array.isArray(d[key])) {
        throw new BadRequestException(`Invalid backup data: missing or invalid ${key}`);
      }
    }
  }

  private async createWithIdMap<T extends { id: string }>(
    records: T[],
    createFn: (record: T) => Promise<{ id: string }>,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    for (const record of records) {
      const { id } = await createFn(record);
      map.set(record.id, id);
    }
    return map;
  }
}
