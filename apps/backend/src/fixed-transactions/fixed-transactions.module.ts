import { Module } from '@nestjs/common';
import { FixedTransactionsController } from './fixed-transactions.controller';
import { FixedTransactionsService } from './fixed-transactions.service';
import { FixedTransactionsOccurrencesController } from './fixed-transactions-occurrences.controller';
import { FixedTransactionsOccurrencesService } from './fixed-transactions-occurrences.service';

/**
 * Controller order matters: `fixed-transactions/occurrences` must be registered
 * before `fixed-transactions/:id`, otherwise the literal path is captured by the
 * parameterised one.
 *
 * Ownership of categories, accounts and cards is checked against Prisma here
 * rather than through the sibling modules' services, so this slice has no
 * cross-module runtime dependency to keep in sync.
 */
@Module({
  providers: [FixedTransactionsService, FixedTransactionsOccurrencesService],
  controllers: [FixedTransactionsOccurrencesController, FixedTransactionsController],
  exports: [FixedTransactionsService, FixedTransactionsOccurrencesService],
})
export class FixedTransactionsModule {}
