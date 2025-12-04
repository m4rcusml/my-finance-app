import { Module } from '@nestjs/common';
import { AccountsModule } from 'src/accounts/accounts.module';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AccountsModule, TransactionsModule],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule { }
