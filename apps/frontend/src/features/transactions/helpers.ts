import type { Category, Money, TransactionType, TransactionWithRelations } from '@finance/contracts';

/**
 * Small pure helpers shared by the transaction screens. Kept out of the
 * components so they can be reasoned about (and, later, tested) on their own.
 */

/**
 * Parses what a Brazilian actually types into a `Money` number.
 *
 * `1.234,56` and `1234.56` and `1234,56` all mean the same amount. The rule is
 * unambiguous: if there is a comma it is the decimal separator and every dot is
 * a thousands separator; with no comma, a dot is the decimal separator.
 * Returns `null` for anything that is not a number, so the caller can show a
 * field error instead of silently POSTing `NaN`.
 */
export function parseMoneyInput(raw: string): Money | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed.replace(/\s/g, '');

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  // Money carries at most 2 decimals; round here rather than letting the server
  // reject a value the user cannot see is wrong.
  return Math.round(value * 100) / 100;
}

/** The inverse, for pre-filling the edit form: `1234.5` -> `1234,50`. */
export function moneyToInput(value: Money): string {
  return value.toFixed(2).replace('.', ',');
}

export interface TransactionOrigin {
  /** `Conta` or `Cartão`; `null` when the API sent neither relation. */
  kind: 'Conta' | 'Cartão' | null;
  /** The human name — never the raw UUID. */
  name: string;
}

/**
 * Where the money moved. Reads the denormalised relation the list endpoint
 * already sends, so no screen ever has to resolve an id against another list.
 */
export function transactionOrigin(transaction: TransactionWithRelations): TransactionOrigin {
  if (transaction.account) return { kind: 'Conta', name: transaction.account.name };
  if (transaction.creditCard) return { kind: 'Cartão', name: transaction.creditCard.name };
  return { kind: null, name: '—' };
}

/** The category NAME the API sent, or an honest placeholder. Never the id. */
export function categoryLabel(transaction: TransactionWithRelations): string {
  return transaction.category?.name ?? 'Sem categoria';
}

/**
 * Categories a transaction of `type` may use: the matching ones plus `both`.
 * `keepId` is always included even when it no longer matches, so editing an old
 * row cannot silently drop the category it already has.
 */
export function categoryOptions(categories: Category[], type: TransactionType, keepId?: string | null): Category[] {
  return categories.filter((category) => category.type === type || category.type === 'both' || category.id === keepId);
}
