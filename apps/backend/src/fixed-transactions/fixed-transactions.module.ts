import { Module } from '@nestjs/common';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { FixedTransactionsController } from './fixed-transactions.controller';
import { FixedTransactionsService } from './fixed-transactions.service';
import { FixedTransactionsOccurrencesController } from './fixed-transactions-occurrences.controller';
import { FixedTransactionsOccurrencesService } from './fixed-transactions-occurrences.service';

@Module({
  imports: [TransactionsModule],
  providers: [FixedTransactionsService, FixedTransactionsOccurrencesService],
  controllers: [FixedTransactionsController, FixedTransactionsOccurrencesController],
  exports: [FixedTransactionsService, FixedTransactionsOccurrencesService]
})
export class FixedTransactionsModule { }
