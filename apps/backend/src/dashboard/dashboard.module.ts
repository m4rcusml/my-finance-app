import { Module } from '@nestjs/common';
import { AccountsModule } from 'src/accounts/accounts.module';
import { FixedTransactionsModule } from 'src/fixed-transactions/fixed-transactions.module';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AccountsModule, TransactionsModule, FixedTransactionsModule],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule { }
