import type { BankStrategy } from './bank-strategy.interface';
import { GenericBankStrategy } from './generic-bank.strategy';
import { InterStrategy } from './inter.strategy';

const strategies: BankStrategy[] = [new InterStrategy(), new GenericBankStrategy()];

export class StrategyFactory {
  static getStrategy(origin: string): BankStrategy {
    const strategy = strategies.find((s) => s.supports(origin));
    if (!strategy) {
      throw new Error(`No strategy found for origin: ${origin}`);
    }
    return strategy;
  }
}
