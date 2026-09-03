import type {
  CategoryType,
  FixedTransaction,
  FixedTransactionOccurrence,
  FixedTransactionType,
  IsoTimestamp,
  OccurrenceStatus,
  OccurrenceWithTemplate,
} from '@finance/contracts';
import { toCivilDate } from '../common/civil-date';
import { toMoney } from '../common/money';

/**
 * The Prisma row shapes these mappers accept.
 *
 * They are written structurally rather than imported from the generated client
 * so that money stays `unknown` (Prisma hands back a `Decimal`, tests hand back
 * a number or a string) and every conversion is forced through `toMoney` /
 * `toCivilDate`. Nothing in this module ever returns a raw `Decimal` or a
 * `Date`.
 */
export interface FixedTransactionRow {
  id: string;
  userId: string;
  type: FixedTransactionType;
  value: unknown;
  referenceDay: number;
  marginDays: number;
  accountId: string | null;
  creditCardId: string | null;
  categoryId: string;
  description: string | null;
  isActive: boolean;
  archivedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface OccurrenceRow {
  id: string;
  fixedTransactionId: string;
  userId: string;
  periodYear: number;
  periodMonth: number;
  status: OccurrenceStatus;
  realDate: Date | string | null;
  dueDate: Date | string;
  transactionId: string | null;
  type: FixedTransactionType;
  value: unknown;
  description: string | null;
  categoryId: string;
  accountId: string | null;
  creditCardId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface OccurrenceRowWithTemplate extends OccurrenceRow {
  fixedTransaction: { id: string; description: string | null; referenceDay: number; marginDays?: number };
  category?: { id: string; name: string; type: CategoryType } | null;
}

/** Audit timestamps go out as ISO-8601 instants, never as `Date` objects. */
export function toIso(value: Date | string): IsoTimestamp {
  return typeof value === 'string' ? value : value.toISOString();
}

export function toIsoOrNull(value: Date | string | null): IsoTimestamp | null {
  return value === null || value === undefined ? null : toIso(value);
}

export function toFixedTransaction(row: FixedTransactionRow): FixedTransaction {
  return {
    id: row.id,
    type: row.type,
    value: toMoney(row.value),
    referenceDay: row.referenceDay,
    marginDays: row.marginDays,
    accountId: row.accountId,
    creditCardId: row.creditCardId,
    categoryId: row.categoryId,
    description: row.description,
    isActive: row.isActive,
    archivedAt: toIsoOrNull(row.archivedAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export function toOccurrence(row: OccurrenceRow): FixedTransactionOccurrence {
  return {
    id: row.id,
    fixedTransactionId: row.fixedTransactionId,
    periodYear: row.periodYear,
    periodMonth: row.periodMonth,
    status: row.status,
    realDate: row.realDate === null || row.realDate === undefined ? null : toCivilDate(row.realDate),
    transactionId: row.transactionId,
    dueDate: toCivilDate(row.dueDate),
    type: row.type,
    value: toMoney(row.value),
    description: row.description,
    categoryId: row.categoryId,
    accountId: row.accountId,
    creditCardId: row.creditCardId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

/**
 * `marginDays` is selected alongside the template so `confirm` can validate the
 * booking window, but it is deliberately dropped here: the contract's
 * `fixedTransaction` block is exactly `id | description | referenceDay`.
 */
export function toOccurrenceWithTemplate(row: OccurrenceRowWithTemplate): OccurrenceWithTemplate {
  return {
    ...toOccurrence(row),
    fixedTransaction: {
      id: row.fixedTransaction.id,
      description: row.fixedTransaction.description,
      referenceDay: row.fixedTransaction.referenceDay,
    },
    category: row.category
      ? { id: row.category.id, name: row.category.name, type: row.category.type }
      : null,
  };
}
