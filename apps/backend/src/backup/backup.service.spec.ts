import type { BackupFile } from '@finance/contracts';
import { PayloadTooLargeException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BackupService } from './backup.service';

/**
 * These suites run against a small in-memory stand-in for Prisma rather than a
 * pile of `mockResolvedValue` calls, because the properties that matter here —
 * a faithful round-trip, a transaction that rolls back, ids that are remapped
 * — are statements about *state*, and you cannot observe state with a mock that
 * returns a constant. The fake implements only what this service uses:
 * `findMany` (keyset pagination + `select`), `createMany`, `deleteMany`,
 * `count` (including relation filters), `groupBy`, `findUnique` and an
 * interactive `$transaction` that really does undo its writes on failure.
 */

type Row = Record<string, any>;

const MODELS = [
  'user',
  'account',
  'creditCard',
  'category',
  'transaction',
  'fixedTransaction',
  'fixedTransactionOccurrence',
  'marketAsset',
  'investment',
  'goal',
  'importedFile',
  'importBatch',
  'importBatchRow',
] as const;

type ModelName = (typeof MODELS)[number];

/** Relation name -> (foreign key column, target model), for `count` filters. */
const RELATIONS: Partial<Record<ModelName, Record<string, { fk: string; model: ModelName }>>> = {
  transaction: {
    account: { fk: 'accountId', model: 'account' },
    creditCard: { fk: 'creditCardId', model: 'creditCard' },
    category: { fk: 'categoryId', model: 'category' },
  },
  fixedTransaction: {
    account: { fk: 'accountId', model: 'account' },
    creditCard: { fk: 'creditCardId', model: 'creditCard' },
    category: { fk: 'categoryId', model: 'category' },
  },
  fixedTransactionOccurrence: {
    account: { fk: 'accountId', model: 'account' },
    creditCard: { fk: 'creditCardId', model: 'creditCard' },
    category: { fk: 'categoryId', model: 'category' },
    fixedTransaction: { fk: 'fixedTransactionId', model: 'fixedTransaction' },
    transaction: { fk: 'transactionId', model: 'transaction' },
  },
  investment: { marketAsset: { fk: 'marketAssetId', model: 'marketAsset' } },
  goal: {
    relatedAccount: { fk: 'relatedAccountId', model: 'account' },
    relatedCategory: { fk: 'relatedCategoryId', model: 'category' },
  },
  importBatchRow: { batch: { fk: 'batchId', model: 'importBatch' } },
};

function matchesScalar(value: unknown, condition: unknown): boolean {
  if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
    const clause = condition as Record<string, unknown>;
    if ('in' in clause) return (clause.in as unknown[]).includes(value);
    if ('not' in clause) return clause.not === null ? value !== null && value !== undefined : value !== clause.not;
    return true;
  }
  return value === condition;
}

class FakeDatabase {
  readonly tables: Record<ModelName, Row[]> = MODELS.reduce(
    (acc, model) => {
      acc[model] = [];
      return acc;
    },
    {} as Record<ModelName, Row[]>,
  );

  matches(model: ModelName, row: Row, where: any): boolean {
    if (!where) return true;
    return Object.entries(where).every(([key, condition]) => {
      if (key === 'OR') return (condition as any[]).some((clause) => this.matches(model, row, clause));
      if (key === 'AND') return (condition as any[]).every((clause) => this.matches(model, row, clause));
      const relation = RELATIONS[model]?.[key];
      if (relation) {
        const fk = row[relation.fk];
        if (fk === null || fk === undefined) return false;
        const target = this.tables[relation.model].find((candidate) => candidate.id === fk);
        if (!target) return false;
        const inner = (condition as any)?.is ?? condition;
        return this.matches(relation.model, target, inner);
      }
      return matchesScalar(row[key], condition);
    });
  }

  snapshot(): Record<ModelName, Row[]> {
    return structuredClone(this.tables);
  }

  restore(snapshot: Record<ModelName, Row[]>): void {
    for (const model of MODELS) this.tables[model] = structuredClone(snapshot[model]);
  }
}

function project(row: Row, select?: Record<string, boolean>): Row {
  if (!select) return { ...row };
  const out: Row = {};
  for (const key of Object.keys(select)) if (select[key]) out[key] = row[key] ?? null;
  return out;
}

function createFakePrisma() {
  const db = new FakeDatabase();
  const client: Record<string, any> = {};

  for (const model of MODELS) {
    client[model] = {
      findMany: jest.fn(async (args: any = {}) => {
        let rows = db.tables[model].filter((row) => db.matches(model, row, args.where));
        rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        if (args.cursor) {
          const index = rows.findIndex((row) => row.id === args.cursor.id);
          rows = index === -1 ? [] : rows.slice(index + (args.skip ?? 0));
        }
        if (typeof args.take === 'number') rows = rows.slice(0, args.take);
        return rows.map((row) => project(row, args.select));
      }),
      findUnique: jest.fn(async (args: any) => {
        const row = db.tables[model].find((candidate) => candidate.id === args.where.id);
        return row ? project(row, args.select) : null;
      }),
      createMany: jest.fn(async (args: any) => {
        const rows: Row[] = Array.isArray(args.data) ? args.data : [args.data];
        for (const row of rows) {
          if (db.tables[model].some((existing) => existing.id === row.id)) {
            throw Object.assign(new Error(`Unique constraint failed on ${model}.id`), { code: 'P2002' });
          }
          db.tables[model].push({ ...row });
        }
        return { count: rows.length };
      }),
      deleteMany: jest.fn(async (args: any = {}) => {
        const kept = db.tables[model].filter((row) => !db.matches(model, row, args.where));
        const count = db.tables[model].length - kept.length;
        db.tables[model] = kept;
        return { count };
      }),
      count: jest.fn(
        async (args: any = {}) => db.tables[model].filter((row) => db.matches(model, row, args.where)).length,
      ),
      groupBy: jest.fn(async (args: any) => {
        const rows = db.tables[model].filter((row) => db.matches(model, row, args.where));
        const buckets = new Map<string, Row>();
        for (const row of rows) {
          const key = (args.by as string[]).map((field) => String(row[field])).join('|');
          const bucket = buckets.get(key) ?? {
            ...Object.fromEntries((args.by as string[]).map((field) => [field, row[field]])),
            _sum: { value: 0 },
          };
          bucket._sum.value += Number(row.value ?? 0);
          buckets.set(key, bucket);
        }
        return [...buckets.values()];
      }),
    };
  }

  client.$transaction = jest.fn(async (arg: any) => {
    if (typeof arg !== 'function') return await Promise.all(arg);
    const snapshot = db.snapshot();
    try {
      return await arg(client);
    } catch (error) {
      db.restore(snapshot);
      throw error;
    }
  });

  return { client: client as unknown as PrismaService, db };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AT = (iso: string) => new Date(iso);
const ON = (civil: string) => new Date(`${civil}T00:00:00.000Z`);

function seedLedger(db: FakeDatabase, userId: string): void {
  db.tables.user.push({
    id: userId,
    email: `${userId}@exemplo.com`,
    name: 'Pessoa Teste',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$SEGREDOABSOLUTO',
    tokenVersion: 7,
    createdAt: AT('2026-01-01T00:00:00.000Z'),
    updatedAt: AT('2026-01-01T00:00:00.000Z'),
  });

  db.tables.account.push(
    {
      id: 'acc-corrente',
      userId,
      name: 'Conta Corrente',
      institution: 'Inter',
      type: 'checking',
      initialBalance: 1000,
      isActive: true,
      archivedAt: null,
      createdAt: AT('2026-01-02T10:00:00.000Z'),
      updatedAt: AT('2026-01-02T10:00:00.000Z'),
    },
    {
      id: 'acc-antiga',
      userId,
      name: 'Conta Antiga',
      institution: 'Banco X',
      type: 'savings',
      initialBalance: 50.5,
      isActive: false,
      archivedAt: AT('2026-02-01T00:00:00.000Z'),
      createdAt: AT('2026-01-03T10:00:00.000Z'),
      updatedAt: AT('2026-02-01T00:00:00.000Z'),
    },
  );

  db.tables.creditCard.push({
    id: 'card-1',
    userId,
    name: 'Cartão Preto',
    institution: 'Inter',
    limitTotal: 5000,
    closingDay: 10,
    isActive: true,
    archivedAt: null,
    createdAt: AT('2026-01-04T10:00:00.000Z'),
    updatedAt: AT('2026-01-04T10:00:00.000Z'),
  });

  db.tables.category.push(
    {
      id: 'cat-mercado',
      userId,
      name: 'Mercado',
      type: 'expense',
      isActive: true,
      archivedAt: null,
      createdAt: AT('2026-01-05T10:00:00.000Z'),
      updatedAt: AT('2026-01-05T10:00:00.000Z'),
    },
    {
      id: 'cat-salario',
      userId,
      name: 'Salário',
      type: 'income',
      isActive: true,
      archivedAt: null,
      createdAt: AT('2026-01-05T10:00:00.000Z'),
      updatedAt: AT('2026-01-05T10:00:00.000Z'),
    },
  );

  db.tables.transaction.push(
    {
      id: 'tx-salario',
      userId,
      type: 'income',
      value: 4200.75,
      date: ON('2026-03-05'),
      accountId: 'acc-corrente',
      creditCardId: null,
      categoryId: 'cat-salario',
      description: 'Salário de março',
      source: 'fixed',
      externalId: null,
      importBatchId: null,
      createdAt: AT('2026-03-05T12:00:00.000Z'),
      updatedAt: AT('2026-03-05T12:00:00.000Z'),
    },
    {
      id: 'tx-mercado',
      userId,
      type: 'expense',
      value: 231.4,
      date: ON('2026-03-07'),
      accountId: null,
      creditCardId: 'card-1',
      categoryId: 'cat-mercado',
      description: 'Compra do mês',
      source: 'manual',
      externalId: null,
      importBatchId: null,
      createdAt: AT('2026-03-07T12:00:00.000Z'),
      updatedAt: AT('2026-03-07T12:00:00.000Z'),
    },
    {
      id: 'tx-importada',
      userId,
      type: 'expense',
      value: 89.9,
      date: ON('2026-03-09'),
      accountId: 'acc-corrente',
      creditCardId: null,
      categoryId: null,
      description: 'PIX enviado',
      source: 'imported',
      externalId: 'inter:2026-03-09:89.90:1',
      importBatchId: null,
      createdAt: AT('2026-03-09T12:00:00.000Z'),
      updatedAt: AT('2026-03-09T12:00:00.000Z'),
    },
  );

  db.tables.fixedTransaction.push({
    id: 'fix-salario',
    userId,
    type: 'income',
    value: 4200.75,
    referenceDay: 5,
    marginDays: 3,
    accountId: 'acc-corrente',
    creditCardId: null,
    categoryId: 'cat-salario',
    description: 'Salário',
    isActive: true,
    archivedAt: null,
    createdAt: AT('2026-01-06T10:00:00.000Z'),
    updatedAt: AT('2026-01-06T10:00:00.000Z'),
  });

  db.tables.fixedTransactionOccurrence.push(
    {
      id: 'occ-marco',
      userId,
      fixedTransactionId: 'fix-salario',
      periodYear: 2026,
      periodMonth: 3,
      status: 'confirmed',
      realDate: ON('2026-03-05'),
      dueDate: ON('2026-03-05'),
      transactionId: 'tx-salario',
      type: 'income',
      value: 4200.75,
      description: 'Salário',
      categoryId: 'cat-salario',
      accountId: 'acc-corrente',
      creditCardId: null,
      createdAt: AT('2026-03-01T00:00:00.000Z'),
      updatedAt: AT('2026-03-05T12:00:00.000Z'),
    },
    {
      id: 'occ-abril',
      userId,
      fixedTransactionId: 'fix-salario',
      periodYear: 2026,
      periodMonth: 4,
      status: 'pending',
      realDate: null,
      dueDate: ON('2026-04-05'),
      transactionId: null,
      type: 'income',
      value: 4200.75,
      description: 'Salário',
      categoryId: 'cat-salario',
      accountId: 'acc-corrente',
      creditCardId: null,
      createdAt: AT('2026-04-01T00:00:00.000Z'),
      updatedAt: AT('2026-04-01T00:00:00.000Z'),
    },
  );

  db.tables.marketAsset.push({
    id: 'asset-petr4',
    userId,
    symbol: 'PETR4',
    type: 'stock',
    exchange: 'B3',
    name: 'Petrobras PN',
    createdAt: AT('2026-01-07T10:00:00.000Z'),
    updatedAt: AT('2026-01-07T10:00:00.000Z'),
  });

  db.tables.investment.push({
    id: 'inv-1',
    userId,
    marketAssetId: 'asset-petr4',
    broker: 'Inter Invest',
    type: 'stock',
    quantity: 12.34567891,
    buyPrice: 38.12,
    investedAmount: 470.6,
    buyDate: ON('2026-02-14'),
    createdAt: AT('2026-02-14T10:00:00.000Z'),
    updatedAt: AT('2026-02-14T10:00:00.000Z'),
  });

  db.tables.goal.push({
    id: 'goal-1',
    userId,
    name: 'Reserva de emergência',
    type: 'saving',
    targetAmount: 30000,
    currentAmount: 7500,
    deadline: ON('2026-12-31'),
    relatedCategoryId: 'cat-salario',
    relatedAccountId: 'acc-corrente',
    createdAt: AT('2026-01-08T10:00:00.000Z'),
    updatedAt: AT('2026-01-08T10:00:00.000Z'),
  });

  db.tables.importedFile.push({
    id: 'imp-1',
    userId,
    batchId: 'batch-1',
    origin: 'inter',
    fileName: 'extrato-marco.ofx',
    fileType: 'ofx',
    status: 'completed',
    importedAt: AT('2026-03-09T11:00:00.000Z'),
    totalRecords: 41,
    createdAt: AT('2026-03-09T11:00:00.000Z'),
    updatedAt: AT('2026-03-09T11:00:00.000Z'),
  });
}

function seedEmptyUser(db: FakeDatabase, userId: string): void {
  db.tables.user.push({
    id: userId,
    email: `${userId}@exemplo.com`,
    name: 'Destino',
    passwordHash: '$argon2id$v=19$OUTRO-SEGREDO',
    tokenVersion: 0,
    createdAt: AT('2026-01-01T00:00:00.000Z'),
    updatedAt: AT('2026-01-01T00:00:00.000Z'),
  });
}

/**
 * Semantic form of a backup: ids are replaced by the natural key of the row
 * they point at, so two exports match when they describe the same ledger even
 * though every primary key was regenerated.
 */
function canonical(file: BackupFile) {
  const account = new Map(file.accounts.map((row) => [row.id, row.name]));
  const card = new Map(file.creditCards.map((row) => [row.id, row.name]));
  const category = new Map(file.categories.map((row) => [row.id, `${row.name}/${row.type}`]));
  const fixed = new Map(file.fixedTransactions.map((row) => [row.id, `${row.description}/${row.referenceDay}`]));
  const transaction = new Map(file.transactions.map((row) => [row.id, `${row.date}/${row.value}/${row.description}`]));
  const asset = new Map(file.marketAssets.map((row) => [row.id, `${row.symbol}/${row.exchange}`]));
  const ref = (map: Map<string, string>, id: string | null) =>
    id === null ? null : (map.get(id) ?? `DESCONHECIDO:${id}`);
  const sorted = <T>(rows: T[], key: (row: T) => string) => [...rows].sort((a, b) => key(a).localeCompare(key(b)));

  return {
    schemaVersion: file.schemaVersion,
    user: file.user,
    accounts: sorted(file.accounts, (row) => row.name).map(({ id, ...rest }) => rest),
    creditCards: sorted(file.creditCards, (row) => row.name).map(({ id, ...rest }) => rest),
    categories: sorted(file.categories, (row) => row.name).map(({ id, ...rest }) => rest),
    transactions: sorted(file.transactions, (row) => row.date + row.value).map(
      ({ id, accountId, creditCardId, categoryId, ...rest }) => ({
        ...rest,
        account: ref(account, accountId),
        creditCard: ref(card, creditCardId),
        category: ref(category, categoryId),
      }),
    ),
    fixedTransactions: sorted(file.fixedTransactions, (row) => String(row.description)).map(
      ({ id, accountId, creditCardId, categoryId, ...rest }) => ({
        ...rest,
        account: ref(account, accountId),
        creditCard: ref(card, creditCardId),
        category: ref(category, categoryId),
      }),
    ),
    fixedTransactionOccurrences: sorted(
      file.fixedTransactionOccurrences,
      (row) => `${row.periodYear}-${row.periodMonth}`,
    ).map(({ id, fixedTransactionId, transactionId, accountId, creditCardId, categoryId, ...rest }) => ({
      ...rest,
      fixedTransaction: ref(fixed, fixedTransactionId),
      transaction: ref(transaction, transactionId),
      account: ref(account, accountId),
      creditCard: ref(card, creditCardId),
      category: ref(category, categoryId),
    })),
    marketAssets: sorted(file.marketAssets, (row) => row.symbol).map(({ id, ...rest }) => rest),
    investments: sorted(file.investments, (row) => row.broker).map(({ id, marketAssetId, ...rest }) => ({
      ...rest,
      marketAsset: ref(asset, marketAssetId),
    })),
    goals: sorted(file.goals, (row) => row.name).map(({ id, relatedAccountId, relatedCategoryId, ...rest }) => ({
      ...rest,
      relatedAccount: ref(account, relatedAccountId),
      relatedCategory: ref(category, relatedCategoryId),
    })),
    importedFiles: sorted(file.importedFiles, (row) => row.fileName).map(({ id, ...rest }) => rest),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('BackupService', () => {
  let service: BackupService;
  let db: FakeDatabase;

  const OWNER = 'user-a';
  const TARGET = 'user-b';

  beforeEach(async () => {
    const fake = createFakePrisma();
    db = fake.db;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        { provide: PrismaService, useValue: fake.client },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => (key === 'APP_TIMEZONE' ? 'America/Sao_Paulo' : 20 * 1024 * 1024)),
          },
        },
      ],
    }).compile();

    service = module.get(BackupService);
    seedLedger(db, OWNER);
    seedEmptyUser(db, TARGET);
  });

  // -------------------------------------------------------------------------

  describe('exportBackup', () => {
    it('exporta todas as entidades, inclusive as ocorrências que a versão anterior descartava', async () => {
      const file = await service.exportBackup(OWNER);

      expect(file.schemaVersion).toBe(1);
      expect(file.accounts).toHaveLength(2);
      expect(file.creditCards).toHaveLength(1);
      expect(file.categories).toHaveLength(2);
      expect(file.transactions).toHaveLength(3);
      expect(file.fixedTransactions).toHaveLength(1);
      expect(file.fixedTransactionOccurrences).toHaveLength(2);
      expect(file.marketAssets).toHaveLength(1);
      expect(file.investments).toHaveLength(1);
      expect(file.goals).toHaveLength(1);
      expect(file.importedFiles).toHaveLength(1);
    });

    it('serializa datas civis, dinheiro e quantidades no formato do contrato', async () => {
      const file = await service.exportBackup(OWNER);

      expect(file.transactions.map((row) => row.date)).toContain('2026-03-05');
      expect(file.investments[0].buyDate).toBe('2026-02-14');
      expect(file.goals[0].deadline).toBe('2026-12-31');
      expect(file.fixedTransactionOccurrences.map((row) => row.dueDate).sort()).toEqual(['2026-03-05', '2026-04-05']);
      expect(file.fixedTransactionOccurrences.find((row) => row.status === 'confirmed')?.realDate).toBe('2026-03-05');
      expect(file.investments[0].quantity).toBe(12.34567891);
      expect(file.transactions.every((row) => typeof row.value === 'number')).toBe(true);
      // initialBalance 1000 + 4200.75 - 89.90; the card expense does not touch it.
      const corrente = file.accounts.find((row) => row.name === 'Conta Corrente');
      expect(corrente?.balance).toBe(5110.85);
      expect(file.goals[0].progress).toBe(0.25);
    });

    it('nunca expõe passwordHash, tokenVersion ou qualquer credencial', async () => {
      const file = await service.exportBackup(OWNER);
      const serialized = JSON.stringify(file);

      expect(Object.keys(file.user).sort()).toEqual(['email', 'name']);
      expect(serialized).not.toContain('passwordHash');
      expect(serialized).not.toContain('password_hash');
      expect(serialized).not.toContain('$argon2id');
      expect(serialized).not.toContain('tokenVersion');
      expect(serialized).not.toContain('SEGREDOABSOLUTO');
    });

    it('nomeia o arquivo com a data civil corrente', () => {
      expect(service.exportFileName()).toMatch(/^finance-backup-\d{4}-\d{2}-\d{2}\.json$/);
    });
  });

  // -------------------------------------------------------------------------

  describe('round-trip', () => {
    it('exporta, restaura em uma conta limpa e produz um ledger semanticamente idêntico', async () => {
      const original = await service.exportBackup(OWNER);

      const result = await service.restoreBackup(TARGET, 'replace', JSON.parse(JSON.stringify(original)));

      expect(result.mode).toBe('replace');
      expect(result.schemaVersion).toBe(1);
      expect(result.created).toEqual({
        accounts: 2,
        creditCards: 1,
        categories: 2,
        transactions: 3,
        fixedTransactions: 1,
        fixedTransactionOccurrences: 2,
        marketAssets: 1,
        investments: 1,
        goals: 1,
        importedFiles: 1,
      });

      const restored = await service.exportBackup(TARGET);
      expect(canonical(restored)).toEqual({
        ...canonical(original),
        user: { email: 'user-b@exemplo.com', name: 'Destino' },
      });
    });

    it('grava tudo sob o userId de quem chamou e nunca reaproveita um id do arquivo', async () => {
      const original = await service.exportBackup(OWNER);
      await service.restoreBackup(TARGET, 'replace', original);

      const payloadIds = new Set([
        ...original.accounts.map((row) => row.id),
        ...original.transactions.map((row) => row.id),
        ...original.categories.map((row) => row.id),
      ]);

      const written = [...db.tables.account, ...db.tables.transaction, ...db.tables.category].filter(
        (row) => row.userId === TARGET,
      );
      expect(written).not.toHaveLength(0);
      for (const row of written) expect(payloadIds.has(row.id)).toBe(false);

      // The owner's ledger is untouched by somebody else's restore.
      expect(db.tables.transaction.filter((row) => row.userId === OWNER)).toHaveLength(3);
    });

    it('é idempotente em replace: restaurar o mesmo arquivo duas vezes converge para o mesmo estado', async () => {
      const original = await service.exportBackup(OWNER);

      await service.restoreBackup(TARGET, 'replace', original);
      const first = await service.exportBackup(TARGET);

      const second = await service.restoreBackup(TARGET, 'replace', original);
      const after = await service.exportBackup(TARGET);

      expect(second.deleted.transactions).toBe(3);
      expect(second.created.transactions).toBe(3);
      expect(db.tables.transaction.filter((row) => row.userId === TARGET)).toHaveLength(3);
      // Ids included: a replace converges instead of duplicating under new uuids.
      expect(after.transactions.map((row) => row.id).sort()).toEqual(first.transactions.map((row) => row.id).sort());
      expect(canonical(after)).toEqual(canonical(first));
    });
  });

  // -------------------------------------------------------------------------

  describe('merge', () => {
    it('mantém o que já existe e ignora transações com externalId repetido', async () => {
      const original = await service.exportBackup(OWNER);
      await service.restoreBackup(TARGET, 'replace', original);

      const result = await service.restoreBackup(TARGET, 'merge', original);

      expect(result.deleted.transactions).toBe(0);
      // The imported row carries an externalId that already exists: 3 - 1 = 2.
      expect(result.created.transactions).toBe(2);
      expect(db.tables.transaction.filter((row) => row.userId === TARGET)).toHaveLength(5);
      // Categories have a per-user unique key, so the merge reuses them.
      expect(result.created.categories).toBe(0);
      expect(db.tables.category.filter((row) => row.userId === TARGET)).toHaveLength(2);
      expect(db.tables.marketAsset.filter((row) => row.userId === TARGET)).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------

  describe('atomicidade', () => {
    it('desfaz tudo quando uma escrita no meio da restauração falha', async () => {
      const original = await service.exportBackup(OWNER);
      const prisma = (service as unknown as { prisma: Record<string, any> }).prisma;
      prisma.goal.createMany.mockRejectedValueOnce(new Error('falha simulada no meio da restauração'));

      await expect(service.restoreBackup(TARGET, 'replace', original)).rejects.toThrow(
        'falha simulada no meio da restauração',
      );

      for (const model of MODELS) {
        expect(db.tables[model].filter((row) => row.userId === TARGET && model !== 'user')).toHaveLength(0);
      }
      // And the source ledger is still intact.
      expect(db.tables.transaction.filter((row) => row.userId === OWNER)).toHaveLength(3);
    });

    it('desfaz a restauração se a verificação final encontrar uma referência de outro usuário', async () => {
      const original = await service.exportBackup(OWNER);
      const prisma = (service as unknown as { prisma: Record<string, any> }).prisma;
      // Remapping makes this impossible in practice; the pass is the seatbelt.
      prisma.transaction.count.mockResolvedValueOnce(1);

      await expect(service.restoreBackup(TARGET, 'replace', original)).rejects.toThrow(/integridade/);
      expect(db.tables.account.filter((row) => row.userId === TARGET)).toHaveLength(0);
      expect(db.tables.transaction.filter((row) => row.userId === TARGET)).toHaveLength(0);
    });

    it('não apaga nada quando o arquivo é inválido, mesmo em replace', async () => {
      const original = await service.exportBackup(OWNER);
      await service.restoreBackup(TARGET, 'replace', original);
      const broken = { ...JSON.parse(JSON.stringify(original)), transactions: 'não é uma lista' };

      await expect(service.restoreBackup(TARGET, 'replace', broken)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(db.tables.transaction.filter((row) => row.userId === TARGET)).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------

  describe('validação', () => {
    it('rejeita uma versão de schema estrangeira, nomeando a versão recebida', async () => {
      const original = await service.exportBackup(OWNER);
      const foreign = { ...JSON.parse(JSON.stringify(original)), schemaVersion: 2 };

      await expect(service.restoreBackup(TARGET, 'replace', foreign)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      await expect(service.restoreBackup(TARGET, 'replace', foreign)).rejects.toThrow(/2/);
      await expect(service.restoreBackup(TARGET, 'replace', foreign)).rejects.toThrow(/schemaVersion 1/);
      expect(db.tables.account.filter((row) => row.userId === TARGET)).toHaveLength(0);
    });

    it('rejeita um id de relação que não existe no próprio arquivo, em vez de gravá-lo cru', async () => {
      const original = await service.exportBackup(OWNER);
      const tampered = JSON.parse(JSON.stringify(original));
      // The id of a row that belongs to somebody else — the cross-tenant FK bug.
      tampered.transactions[0].accountId = 'acc-de-outro-usuario';
      tampered.transactions[0].creditCardId = null;

      const error = await service.restoreBackup(TARGET, 'replace', tampered).catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(UnprocessableEntityException);
      const details = (error as UnprocessableEntityException).getResponse() as { message: string[] };
      expect(details.message.join('\n')).toContain('acc-de-outro-usuario');
      expect(db.tables.transaction.filter((row) => row.accountId === 'acc-de-outro-usuario')).toHaveLength(0);
      expect(db.tables.account.filter((row) => row.userId === TARGET)).toHaveLength(0);
    });

    it('reúne todos os problemas do arquivo em details', async () => {
      const original = await service.exportBackup(OWNER);
      const tampered = JSON.parse(JSON.stringify(original));
      tampered.accounts[0].type = 'poupancinha';
      tampered.transactions[0].date = '2026-02-30';
      tampered.transactions[1].value = 10.12345;
      tampered.goals[0].targetAmount = 'muito';

      const error = await service.restoreBackup(TARGET, 'replace', tampered).catch((thrown: unknown) => thrown);
      const details = ((error as UnprocessableEntityException).getResponse() as { message: string[] }).message;

      expect(details.length).toBeGreaterThanOrEqual(4);
      expect(details.join('\n')).toContain('accounts[0].type');
      expect(details.join('\n')).toContain('transactions[0].date');
      expect(details.join('\n')).toContain('2 casas decimais');
      expect(details.join('\n')).toContain('goals[0].targetAmount');
    });

    it('rejeita uma ocorrência confirmada sem transação e uma transação sem origem', async () => {
      const original = await service.exportBackup(OWNER);
      const tampered = JSON.parse(JSON.stringify(original));
      const confirmed = tampered.fixedTransactionOccurrences.find((row: any) => row.status === 'confirmed');
      confirmed.transactionId = null;
      tampered.transactions[1].accountId = tampered.transactions[1].creditCardId;

      const error = await service.restoreBackup(TARGET, 'replace', tampered).catch((thrown: unknown) => thrown);
      const details = ((error as UnprocessableEntityException).getResponse() as { message: string[] }).message.join(
        '\n',
      );

      expect(details).toContain('exatamente uma origem');
      expect(details).toContain('realDate e transactionId');
    });

    it('recusa um payload acima de MAX_BACKUP_BYTES antes de qualquer escrita', async () => {
      const original = await service.exportBackup(OWNER);
      const config = (service as unknown as { config: { get: jest.Mock } }).config;
      config.get.mockImplementation((key: string) => (key === 'APP_TIMEZONE' ? 'UTC' : 16));

      await expect(service.restoreBackup(TARGET, 'replace', original)).rejects.toBeInstanceOf(PayloadTooLargeException);
      expect(db.tables.account.filter((row) => row.userId === TARGET)).toHaveLength(0);
    });
  });
});
