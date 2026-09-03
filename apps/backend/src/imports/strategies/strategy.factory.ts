import type { ImportOrigin } from '@finance/contracts';
import type { BankStrategy } from './bank-strategy.interface';
import { GenericBankStrategy } from './generic-bank.strategy';
import { InterStrategy } from './inter.strategy';

/**
 * Keyed by the contract enum, so an unknown origin is impossible by the time it
 * reaches here — the DTO's `@IsIn(IMPORT_ORIGINS)` already rejected it.
 */
const STRATEGIES: Record<ImportOrigin, BankStrategy> = {
  inter: new InterStrategy(),
  generic: new GenericBankStrategy(),
};

export function getStrategy(origin: ImportOrigin): BankStrategy {
  return STRATEGIES[origin];
}
