import {
  ACCOUNT_TYPES,
  BACKUP_SCHEMA_VERSION,
  type BackupFile,
  CATEGORY_TYPES,
  type CivilDate,
  FIXED_TRANSACTION_TYPES,
  GOAL_TYPES,
  IMPORT_FILE_TYPES,
  IMPORT_ORIGINS,
  IMPORT_STATUSES,
  INVESTMENT_TYPES,
  isCivilDate,
  isOneOf,
  MARKET_ASSET_TYPES,
  OCCURRENCE_STATUSES,
  TRANSACTION_SOURCES,
  TRANSACTION_TYPES,
} from '@finance/contracts';
import { UnprocessableEntityException } from '@nestjs/common';
import {
  MAX_ID_LENGTH,
  MAX_MONEY_ABS,
  MAX_PERIOD_YEAR,
  MAX_QUANTITY_ABS,
  MAX_RESTORE_ROWS_PER_COLLECTION,
  MAX_TEXT_LENGTH,
  MAX_VALIDATION_PROBLEMS,
  MIN_PERIOD_YEAR,
  MONEY_DECIMALS,
  QUANTITY_DECIMALS,
} from './backup.constants';

/**
 * Deep validation of an uploaded `BackupFile`.
 *
 * Everything is checked **before a single row is written**, and every problem is
 * collected instead of aborting on the first one, so a user fixing a hand-edited
 * file sees the whole list at once. The rules mirror the database exactly:
 * enums come from the contracts tuples, civil dates go through `isCivilDate`,
 * money must fit `numeric(15,2)`, and every relation id must resolve to a row
 * that is present in the *same* payload — an unresolved id is a hard error, not
 * something to silently null out and certainly not something to write verbatim
 * (that was the cross-tenant foreign key bug).
 */

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function isRecord(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Decimal places of a JSON number, read off its shortest representation.
 * Exponential notation (`1e-9`) reports as unbounded and is therefore rejected.
 */
function decimalPlaces(value: number): number {
  const text = String(value);
  if (text.includes('e') || text.includes('E')) return Number.POSITIVE_INFINITY;
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** True only for a string an `IsoTimestamp` column can actually store. */
function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 10 || value.length > 40) return false;
  return Number.isFinite(Date.parse(value));
}

/** Bounded description of an untrusted value, so no attacker text is echoed wholesale. */
function describe(value: unknown): string {
  if (value === undefined) return 'ausente';
  if (value === null) return 'nulo';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return `"${value.slice(0, 40)}"`;
  if (Array.isArray(value)) return 'lista';
  return 'objeto';
}

// ---------------------------------------------------------------------------
// Problem collector
// ---------------------------------------------------------------------------

class BackupReader {
  private readonly items: string[] = [];
  private overflow = 0;

  problem(path: string, message: string): void {
    if (this.items.length >= MAX_VALIDATION_PROBLEMS) {
      this.overflow += 1;
      return;
    }
    this.items.push(`${path}: ${message}`);
  }

  get failed(): boolean {
    return this.items.length > 0 || this.overflow > 0;
  }

  details(): string[] {
    if (this.overflow === 0) return [...this.items];
    return [...this.items, `... e mais ${this.overflow} problema(s) não listado(s).`];
  }

  // --- collections -------------------------------------------------------

  list(source: Row, key: string, path: string): Row[] {
    const value = source[key];
    if (!Array.isArray(value)) {
      this.problem(`${path}.${key}`, `é obrigatório e deve ser uma lista (recebido: ${describe(value)}).`);
      return [];
    }
    if (value.length > MAX_RESTORE_ROWS_PER_COLLECTION) {
      this.problem(
        `${path}.${key}`,
        `tem ${value.length} itens e excede o limite de ${MAX_RESTORE_ROWS_PER_COLLECTION}.`,
      );
      return [];
    }
    const rows: Row[] = [];
    value.forEach((item, index) => {
      if (!isRecord(item)) {
        this.problem(`${path}.${key}[${index}]`, 'deve ser um objeto.');
        rows.push({});
        return;
      }
      rows.push(item);
    });
    return rows;
  }

  // --- scalars -----------------------------------------------------------

  text(source: Row, key: string, path: string, max = MAX_TEXT_LENGTH): string {
    const raw = source[key];
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      this.problem(`${path}.${key}`, 'é obrigatório e deve ser um texto não vazio.');
      return '';
    }
    if (raw.length > max) {
      this.problem(`${path}.${key}`, `excede ${max} caracteres.`);
      return '';
    }
    return raw;
  }

  nullableText(source: Row, key: string, path: string, max = MAX_TEXT_LENGTH): string | null {
    const raw = source[key];
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== 'string') {
      this.problem(`${path}.${key}`, 'deve ser um texto ou nulo.');
      return null;
    }
    if (raw.length > max) {
      this.problem(`${path}.${key}`, `excede ${max} caracteres.`);
      return null;
    }
    return raw;
  }

  id(source: Row, key: string, path: string): string {
    return this.text(source, key, path, MAX_ID_LENGTH);
  }

  nullableId(source: Row, key: string, path: string): string | null {
    const value = this.nullableText(source, key, path, MAX_ID_LENGTH);
    return value === null || value.length === 0 ? null : value;
  }

  money(source: Row, key: string, path: string): number {
    const raw = source[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      this.problem(`${path}.${key}`, `deve ser um número finito (recebido: ${describe(raw)}).`);
      return 0;
    }
    if (Math.abs(raw) > MAX_MONEY_ABS) {
      this.problem(`${path}.${key}`, `está fora do intervalo suportado (±${MAX_MONEY_ABS}).`);
      return 0;
    }
    if (decimalPlaces(raw) > MONEY_DECIMALS) {
      this.problem(`${path}.${key}`, `deve ter no máximo ${MONEY_DECIMALS} casas decimais.`);
      return 0;
    }
    return raw;
  }

  /** Derived fields (`balance`, `progress`) are checked when present and ignored on write. */
  optionalMoney(source: Row, key: string, path: string): number {
    if (source[key] === undefined || source[key] === null) return 0;
    return this.money(source, key, path);
  }

  quantity(source: Row, key: string, path: string): number {
    const raw = source[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      this.problem(`${path}.${key}`, `deve ser um número finito (recebido: ${describe(raw)}).`);
      return 0;
    }
    if (Math.abs(raw) > MAX_QUANTITY_ABS) {
      this.problem(`${path}.${key}`, `está fora do intervalo suportado (±${MAX_QUANTITY_ABS}).`);
      return 0;
    }
    if (decimalPlaces(raw) > QUANTITY_DECIMALS) {
      this.problem(`${path}.${key}`, `deve ter no máximo ${QUANTITY_DECIMALS} casas decimais.`);
      return 0;
    }
    return raw;
  }

  int(source: Row, key: string, path: string, min: number, max: number): number {
    const raw = source[key];
    if (typeof raw !== 'number' || !Number.isInteger(raw)) {
      this.problem(`${path}.${key}`, `deve ser um número inteiro (recebido: ${describe(raw)}).`);
      return min;
    }
    if (raw < min || raw > max) {
      this.problem(`${path}.${key}`, `deve estar entre ${min} e ${max}.`);
      return min;
    }
    return raw;
  }

  nullableInt(source: Row, key: string, path: string, min: number, max: number): number | null {
    if (source[key] === null || source[key] === undefined) return null;
    return this.int(source, key, path, min, max);
  }

  bool(source: Row, key: string, path: string, fallback: boolean): boolean {
    const raw = source[key];
    if (raw === undefined) return fallback;
    if (typeof raw !== 'boolean') {
      this.problem(`${path}.${key}`, 'deve ser true ou false.');
      return fallback;
    }
    return raw;
  }

  enumValue<T extends readonly string[]>(values: T, source: Row, key: string, path: string): T[number] {
    const raw = source[key];
    if (isOneOf(values, raw)) return raw;
    this.problem(`${path}.${key}`, `deve ser um de: ${values.join(', ')} (recebido: ${describe(raw)}).`);
    return values[0];
  }

  civilDate(source: Row, key: string, path: string): CivilDate {
    const raw = source[key];
    if (!isCivilDate(raw)) {
      this.problem(
        `${path}.${key}`,
        `deve ser uma data civil válida no formato YYYY-MM-DD (recebido: ${describe(raw)}).`,
      );
      return '1970-01-01';
    }
    return raw;
  }

  nullableCivilDate(source: Row, key: string, path: string): CivilDate | null {
    const raw = source[key];
    if (raw === null || raw === undefined) return null;
    return this.civilDate(source, key, path);
  }

  timestamp(source: Row, key: string, path: string): string {
    const raw = source[key];
    if (!isTimestamp(raw)) {
      this.problem(`${path}.${key}`, `deve ser uma data/hora ISO-8601 válida (recebido: ${describe(raw)}).`);
      return new Date(0).toISOString();
    }
    return raw;
  }

  nullableTimestamp(source: Row, key: string, path: string): string | null {
    const raw = source[key];
    if (raw === null || raw === undefined) return null;
    return this.timestamp(source, key, path);
  }
}

// ---------------------------------------------------------------------------
// Entity readers
// ---------------------------------------------------------------------------

function readAccounts(r: BackupReader, rows: Row[]): BackupFile['accounts'] {
  return rows.map((row, i) => {
    const path = `accounts[${i}]`;
    return {
      id: r.id(row, 'id', path),
      name: r.text(row, 'name', path),
      institution: r.text(row, 'institution', path),
      type: r.enumValue(ACCOUNT_TYPES, row, 'type', path),
      initialBalance: r.money(row, 'initialBalance', path),
      balance: r.optionalMoney(row, 'balance', path),
      isActive: r.bool(row, 'isActive', path, true),
      archivedAt: r.nullableTimestamp(row, 'archivedAt', path),
      createdAt: r.timestamp(row, 'createdAt', path),
      updatedAt: r.timestamp(row, 'updatedAt', path),
    };
  });
}

function readCreditCards(r: BackupReader, rows: Row[]): BackupFile['creditCards'] {
  return rows.map((row, i) => {
    const path = `creditCards[${i}]`;
    return {
      id: r.id(row, 'id', path),
      name: r.text(row, 'name', path),
      institution: r.text(row, 'institution', path),
      limitTotal: r.money(row, 'limitTotal', path),
      closingDay: r.nullableInt(row, 'closingDay', path, 1, 31),
      isActive: r.bool(row, 'isActive', path, true),
      archivedAt: r.nullableTimestamp(row, 'archivedAt', path),
      createdAt: r.timestamp(row, 'createdAt', path),
      updatedAt: r.timestamp(row, 'updatedAt', path),
    };
  });
}

function readCategories(r: BackupReader, rows: Row[]): BackupFile['categories'] {
  return rows.map((row, i) => {
    const path = `categories[${i}]`;
    const color = r.nullableText(row, 'color', path, 7);
    if (color !== null && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      r.problem(`${path}.color`, 'deve ser uma cor hexadecimal, como #a78bfa.');
    }
    return {
      id: r.id(row, 'id', path),
      name: r.text(row, 'name', path),
      type: r.enumValue(CATEGORY_TYPES, row, 'type', path),
      color,
      isActive: r.bool(row, 'isActive', path, true),
      archivedAt: r.nullableTimestamp(row, 'archivedAt', path),
      createdAt: r.timestamp(row, 'createdAt', path),
      updatedAt: r.timestamp(row, 'updatedAt', path),
    };
  });
}

function readTransactions(r: BackupReader, rows: Row[]): BackupFile['transactions'] {
  return rows.map((row, i) => {
    const path = `transactions[${i}]`;
    const accountId = r.nullableId(row, 'accountId', path);
    const creditCardId = r.nullableId(row, 'creditCardId', path);
    if ((accountId === null) === (creditCardId === null)) {
      r.problem(path, 'deve ter exatamente uma origem: accountId ou creditCardId.');
    }
    return {
      id: r.id(row, 'id', path),
      type: r.enumValue(TRANSACTION_TYPES, row, 'type', path),
      value: r.money(row, 'value', path),
      date: r.civilDate(row, 'date', path),
      accountId,
      creditCardId,
      categoryId: r.nullableId(row, 'categoryId', path),
      description: r.nullableText(row, 'description', path),
      source: r.enumValue(TRANSACTION_SOURCES, row, 'source', path),
      externalId: r.nullableText(row, 'externalId', path, MAX_ID_LENGTH),
      createdAt: r.timestamp(row, 'createdAt', path),
      updatedAt: r.timestamp(row, 'updatedAt', path),
    };
  });
}

function readFixedTransactions(r: BackupReader, rows: Row[]): BackupFile['fixedTransactions'] {
  return rows.map((row, i) => {
    const path = `fixedTransactions[${i}]`;
    const accountId = r.nullableId(row, 'accountId', path);
    const creditCardId = r.nullableId(row, 'creditCardId', path);
    if ((accountId === null) === (creditCardId === null)) {
      r.problem(path, 'deve ter exatamente uma origem: accountId ou creditCardId.');
    }
    return {
      id: r.id(row, 'id', path),
      type: r.enumValue(FIXED_TRANSACTION_TYPES, row, 'type', path),
      value: r.money(row, 'value', path),
      referenceDay: r.int(row, 'referenceDay', path, 1, 31),
      marginDays: r.int(row, 'marginDays', path, 0, 27),
      accountId,
      creditCardId,
      categoryId: r.id(row, 'categoryId', path),
      description: r.nullableText(row, 'description', path),
      isActive: r.bool(row, 'isActive', path, true),
      archivedAt: r.nullableTimestamp(row, 'archivedAt', path),
      createdAt: r.timestamp(row, 'createdAt', path),
      updatedAt: r.timestamp(row, 'updatedAt', path),
    };
  });
}

function readOccurrences(r: BackupReader, rows: Row[]): BackupFile['fixedTransactionOccurrences'] {
  return rows.map((row, i) => {
    const path = `fixedTransactionOccurrences[${i}]`;
    const accountId = r.nullableId(row, 'accountId', path);
    const creditCardId = r.nullableId(row, 'creditCardId', path);
    if ((accountId === null) === (creditCardId === null)) {
      r.problem(path, 'deve ter exatamente uma origem: accountId ou creditCardId.');
    }
    const status = r.enumValue(OCCURRENCE_STATUSES, row, 'status', path);
    const realDate = r.nullableCivilDate(row, 'realDate', path);
    const transactionId = r.nullableId(row, 'transactionId', path);
    if (status === 'confirmed' && (realDate === null || transactionId === null)) {
      r.problem(path, 'uma ocorrência confirmada exige realDate e transactionId.');
    }
    if (status !== 'confirmed' && transactionId !== null) {
      r.problem(path, 'somente uma ocorrência confirmada pode referenciar uma transação.');
    }
    return {
      id: r.id(row, 'id', path),
      fixedTransactionId: r.id(row, 'fixedTransactionId', path),
      periodYear: r.int(row, 'periodYear', path, MIN_PERIOD_YEAR, MAX_PERIOD_YEAR),
      periodMonth: r.int(row, 'periodMonth', path, 1, 12),
      status,
      realDate,
      transactionId,
      dueDate: r.civilDate(row, 'dueDate', path),
      type: r.enumValue(FIXED_TRANSACTION_TYPES, row, 'type', path),
      value: r.money(row, 'value', path),
      description: r.nullableText(row, 'description', path),
      categoryId: r.id(row, 'categoryId', path),
      accountId,
      creditCardId,
      createdAt: r.timestamp(row, 'createdAt', path),
      updatedAt: r.timestamp(row, 'updatedAt', path),
    };
  });
}

function readMarketAssets(r: BackupReader, rows: Row[]): BackupFile['marketAssets'] {
  return rows.map((row, i) => {
    const path = `marketAssets[${i}]`;
    return {
      id: r.id(row, 'id', path),
      symbol: r.text(row, 'symbol', path, 32),
      type: r.enumValue(MARKET_ASSET_TYPES, row, 'type', path),
      exchange: r.text(row, 'exchange', path, 32),
      name: r.nullableText(row, 'name', path),
      createdAt: r.timestamp(row, 'createdAt', path),
      updatedAt: r.timestamp(row, 'updatedAt', path),
    };
  });
}

function readInvestments(r: BackupReader, rows: Row[]): BackupFile['investments'] {
  return rows.map((row, i) => {
    const path = `investments[${i}]`;
    return {
      id: r.id(row, 'id', path),
      marketAssetId: r.nullableId(row, 'marketAssetId', path),
      broker: r.text(row, 'broker', path),
      type: r.enumValue(INVESTMENT_TYPES, row, 'type', path),
      quantity: r.quantity(row, 'quantity', path),
      buyPrice: r.money(row, 'buyPrice', path),
      investedAmount: r.money(row, 'investedAmount', path),
      buyDate: r.civilDate(row, 'buyDate', path),
      createdAt: r.timestamp(row, 'createdAt', path),
      updatedAt: r.timestamp(row, 'updatedAt', path),
    };
  });
}

function readGoals(r: BackupReader, rows: Row[]): BackupFile['goals'] {
  return rows.map((row, i) => {
    const path = `goals[${i}]`;
    return {
      id: r.id(row, 'id', path),
      name: r.text(row, 'name', path),
      type: r.enumValue(GOAL_TYPES, row, 'type', path),
      targetAmount: r.money(row, 'targetAmount', path),
      currentAmount: r.optionalMoney(row, 'currentAmount', path),
      deadline: r.nullableCivilDate(row, 'deadline', path),
      relatedCategoryId: r.nullableId(row, 'relatedCategoryId', path),
      relatedAccountId: r.nullableId(row, 'relatedAccountId', path),
      // Derived on read; accepted for round-trip fidelity and recomputed on export.
      progress: 0,
      progressSource: 'manual' as const,
      createdAt: r.timestamp(row, 'createdAt', path),
      updatedAt: r.timestamp(row, 'updatedAt', path),
    };
  });
}

function readImportedFiles(r: BackupReader, rows: Row[]): BackupFile['importedFiles'] {
  return rows.map((row, i) => {
    const path = `importedFiles[${i}]`;
    return {
      id: r.id(row, 'id', path),
      origin: r.enumValue(IMPORT_ORIGINS, row, 'origin', path),
      fileName: r.text(row, 'fileName', path),
      fileType: r.enumValue(IMPORT_FILE_TYPES, row, 'fileType', path),
      status: r.enumValue(IMPORT_STATUSES, row, 'status', path),
      importedAt: r.timestamp(row, 'importedAt', path),
      totalRecords: r.int(row, 'totalRecords', path, 0, Number.MAX_SAFE_INTEGER),
      createdAt: r.timestamp(row, 'createdAt', path),
      updatedAt: r.timestamp(row, 'updatedAt', path),
    };
  });
}

// ---------------------------------------------------------------------------
// Cross-row checks
// ---------------------------------------------------------------------------

function indexIds(r: BackupReader, rows: { id: string }[], collection: string): Set<string> {
  const ids = new Set<string>();
  rows.forEach((row, i) => {
    if (row.id.length === 0) return; // already reported by the field reader
    if (ids.has(row.id)) {
      r.problem(`${collection}[${i}]`, `id duplicado "${row.id}" dentro do arquivo.`);
      return;
    }
    ids.add(row.id);
  });
  return ids;
}

function requireRef(
  r: BackupReader,
  known: Set<string>,
  value: string | null,
  path: string,
  field: string,
  target: string,
): void {
  if (value === null) return;
  if (!known.has(value)) {
    r.problem(`${path}.${field}`, `referencia ${target} "${value}" que não existe neste arquivo.`);
  }
}

function assertUniqueKey(r: BackupReader, seen: Set<string>, key: string, path: string, message: string): void {
  if (seen.has(key)) {
    r.problem(path, message);
    return;
  }
  seen.add(key);
}

function checkRelations(r: BackupReader, file: BackupFile): void {
  const accountIds = indexIds(r, file.accounts, 'accounts');
  const creditCardIds = indexIds(r, file.creditCards, 'creditCards');
  const categoryIds = indexIds(r, file.categories, 'categories');
  const transactionIds = indexIds(r, file.transactions, 'transactions');
  const fixedIds = indexIds(r, file.fixedTransactions, 'fixedTransactions');
  indexIds(r, file.fixedTransactionOccurrences, 'fixedTransactionOccurrences');
  const marketAssetIds = indexIds(r, file.marketAssets, 'marketAssets');
  indexIds(r, file.investments, 'investments');
  indexIds(r, file.goals, 'goals');
  indexIds(r, file.importedFiles, 'importedFiles');

  // categories: unique (userId, name, type) in PostgreSQL.
  const categoryKeys = new Set<string>();
  file.categories.forEach((category, i) => {
    assertUniqueKey(
      r,
      categoryKeys,
      `${category.name}\0${category.type}`,
      `categories[${i}]`,
      `categoria duplicada "${category.name}" (${category.type}) dentro do arquivo.`,
    );
  });

  // marketAssets: unique (userId, symbol, exchange).
  const assetKeys = new Set<string>();
  file.marketAssets.forEach((asset, i) => {
    assertUniqueKey(
      r,
      assetKeys,
      `${asset.symbol}\0${asset.exchange}`,
      `marketAssets[${i}]`,
      `ativo duplicado "${asset.symbol}" em "${asset.exchange}" dentro do arquivo.`,
    );
  });

  // transactions: unique (userId, externalId) where externalId is not null.
  const externalIds = new Set<string>();
  file.transactions.forEach((transaction, i) => {
    const path = `transactions[${i}]`;
    requireRef(r, accountIds, transaction.accountId, path, 'accountId', 'a conta');
    requireRef(r, creditCardIds, transaction.creditCardId, path, 'creditCardId', 'o cartão');
    requireRef(r, categoryIds, transaction.categoryId, path, 'categoryId', 'a categoria');
    if (transaction.externalId !== null) {
      assertUniqueKey(
        r,
        externalIds,
        transaction.externalId,
        path,
        `externalId duplicado "${transaction.externalId}" dentro do arquivo.`,
      );
    }
  });

  file.fixedTransactions.forEach((fixed, i) => {
    const path = `fixedTransactions[${i}]`;
    requireRef(r, accountIds, fixed.accountId, path, 'accountId', 'a conta');
    requireRef(r, creditCardIds, fixed.creditCardId, path, 'creditCardId', 'o cartão');
    requireRef(r, categoryIds, fixed.categoryId, path, 'categoryId', 'a categoria');
  });

  const periodKeys = new Set<string>();
  const bookedTransactions = new Set<string>();
  file.fixedTransactionOccurrences.forEach((occurrence, i) => {
    const path = `fixedTransactionOccurrences[${i}]`;
    requireRef(r, fixedIds, occurrence.fixedTransactionId, path, 'fixedTransactionId', 'o lançamento fixo');
    requireRef(r, categoryIds, occurrence.categoryId, path, 'categoryId', 'a categoria');
    requireRef(r, accountIds, occurrence.accountId, path, 'accountId', 'a conta');
    requireRef(r, creditCardIds, occurrence.creditCardId, path, 'creditCardId', 'o cartão');
    requireRef(r, transactionIds, occurrence.transactionId, path, 'transactionId', 'a transação');
    assertUniqueKey(
      r,
      periodKeys,
      `${occurrence.fixedTransactionId}\0${occurrence.periodYear}\0${occurrence.periodMonth}`,
      path,
      'já existe outra ocorrência para este lançamento fixo neste período.',
    );
    if (occurrence.transactionId !== null) {
      assertUniqueKey(
        r,
        bookedTransactions,
        occurrence.transactionId,
        path,
        `a transação "${occurrence.transactionId}" já está vinculada a outra ocorrência.`,
      );
    }
  });

  file.investments.forEach((investment, i) => {
    requireRef(r, marketAssetIds, investment.marketAssetId, `investments[${i}]`, 'marketAssetId', 'o ativo');
  });

  file.goals.forEach((goal, i) => {
    const path = `goals[${i}]`;
    requireRef(r, categoryIds, goal.relatedCategoryId, path, 'relatedCategoryId', 'a categoria');
    requireRef(r, accountIds, goal.relatedAccountId, path, 'relatedAccountId', 'a conta');
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Parses and validates an untrusted payload into a `BackupFile`.
 *
 * Throws `UnprocessableEntityException` (422). A wrong `schemaVersion` fails
 * on its own, with the offending version named in the message; everything else
 * comes back as a `details` list.
 */
export function parseBackupFile(raw: unknown): BackupFile {
  if (!isRecord(raw)) {
    throw new UnprocessableEntityException('O backup enviado deve ser um objeto JSON.');
  }

  if (raw.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new UnprocessableEntityException(
      `Versão de backup não suportada: ${describe(raw.schemaVersion)}. Esta versão da API só restaura schemaVersion ${BACKUP_SCHEMA_VERSION}.`,
    );
  }

  const r = new BackupReader();
  const user = isRecord(raw.user) ? raw.user : {};
  if (!isRecord(raw.user)) r.problem('user', 'é obrigatório e deve ser um objeto.');

  const file: BackupFile = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: r.timestamp(raw, 'exportedAt', 'backup'),
    user: {
      email: r.text(user, 'email', 'user', 320),
      name: r.nullableText(user, 'name', 'user'),
    },
    accounts: readAccounts(r, r.list(raw, 'accounts', 'backup')),
    creditCards: readCreditCards(r, r.list(raw, 'creditCards', 'backup')),
    categories: readCategories(r, r.list(raw, 'categories', 'backup')),
    transactions: readTransactions(r, r.list(raw, 'transactions', 'backup')),
    fixedTransactions: readFixedTransactions(r, r.list(raw, 'fixedTransactions', 'backup')),
    fixedTransactionOccurrences: readOccurrences(r, r.list(raw, 'fixedTransactionOccurrences', 'backup')),
    marketAssets: readMarketAssets(r, r.list(raw, 'marketAssets', 'backup')),
    investments: readInvestments(r, r.list(raw, 'investments', 'backup')),
    goals: readGoals(r, r.list(raw, 'goals', 'backup')),
    importedFiles: readImportedFiles(r, r.list(raw, 'importedFiles', 'backup')),
  };

  checkRelations(r, file);

  if (r.failed) {
    throw new UnprocessableEntityException({
      statusCode: 422,
      error: 'unprocessable_entity',
      message: r.details(),
    });
  }

  return file;
}
