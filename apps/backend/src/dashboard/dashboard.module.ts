import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { CreditCardsModule } from '../credit-cards/credit-cards.module';
import { FixedTransactionsModule } from '../fixed-transactions/fixed-transactions.module';
import { InvestmentsModule } from '../investments/investments.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * The dashboard owns no tables. It composes the aggregates each domain module
 * exposes, which is why it imports them all and provides nothing of its own.
 */
@Module({
  imports: [AccountsModule, CreditCardsModule, TransactionsModule, FixedTransactionsModule, InvestmentsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
