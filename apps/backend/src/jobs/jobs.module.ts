import { Module } from '@nestjs/common';
import { FixedTransactionsJob } from './fixed-transactions.job';

/**
 * `PrismaModule` is global and `ConfigModule` is registered with `isGlobal`, so
 * the job needs no imports of its own — and, crucially, no dependency on the
 * `FixedTransactionsModule` HTTP layer.
 */
@Module({
  providers: [FixedTransactionsJob],
  exports: [FixedTransactionsJob],
})
export class JobsModule {}
