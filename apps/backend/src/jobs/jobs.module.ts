import { Module } from '@nestjs/common';
import { FixedTransactionsModule } from 'src/fixed-transactions/fixed-transactions.module';
import { FixedTransactionsJob } from './fixed-transactions.job';

@Module({
  imports: [FixedTransactionsModule],
  providers: [FixedTransactionsJob]
})
export class JobsModule { }
