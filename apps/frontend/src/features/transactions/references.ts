'use client';

import type { Account, Category, CreditCard } from '@finance/contracts';
import { useActiveAccountsQuery } from '@/features/accounts/queries';
import { useActiveCategoriesQuery } from '@/features/categories/queries';
import { useActiveCreditCardsQuery } from '@/features/credit-cards/queries';

/**
 * The only place transactions touch another feature's hooks.
 *
 * Selectors need active accounts, cards and categories. Funnelling the three
 * imports through one adapter means a signature change upstream is a one-file
 * fix here instead of a hunt across every screen and dialog.
 */

export interface TransactionReferences {
  accounts: Account[];
  creditCards: CreditCard[];
  categories: Category[];
  /** True until the selector data is known — used to disable empty selects. */
  isPending: boolean;
  /** True when a selector could not be loaded, so the UI can say so honestly. */
  isError: boolean;
}

export function useTransactionReferences(): TransactionReferences {
  const accounts = useActiveAccountsQuery();
  const creditCards = useActiveCreditCardsQuery();
  const categories = useActiveCategoriesQuery();

  return {
    accounts: accounts.items,
    creditCards: creditCards.items,
    categories: categories.items,
    isPending: accounts.query.isPending || creditCards.query.isPending || categories.query.isPending,
    isError: accounts.query.isError || creditCards.query.isError || categories.query.isError,
  };
}
