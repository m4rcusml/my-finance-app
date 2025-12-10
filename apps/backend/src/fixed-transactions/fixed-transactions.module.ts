import { Module } from '@nestjs/common';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { FixedTransactionsController } from './fixed-transactions.controller';
import { FixedTransactionsService } from './fixed-transactions.service';
import { FixedTransactionsOccurrencesController } from './fixed-transactions-occurrences.controller';

@Module({
  imports: [TransactionsModule],
  providers: [FixedTransactionsService],
  controllers: [FixedTransactionsController, FixedTransactionsOccurrencesController]
})
export class FixedTransactionsModule { }
