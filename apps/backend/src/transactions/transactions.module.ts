import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

/**
 * No module imports: ownership of accounts, cards and categories is checked
 * against the database inside the same write transaction. Depending on the
 * other feature services here only bought a dependency cycle risk and a second
 * round-trip per relation.
 *
 * `PrismaModule` and `ConfigModule` are global.
 */
@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
