import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountsModule } from './accounts/accounts.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BackupModule } from './backup/backup.module';
import { CategoriesModule } from './categories/categories.module';
import { CreditCardsModule } from './credit-cards/credit-cards.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FixedTransactionsModule } from './fixed-transactions/fixed-transactions.module';
import { GoalsModule } from './goals/goals.module';
import { ImportsModule } from './imports/imports.module';
import { InvestmentsModule } from './investments/investments.module';
import { JobsModule } from './jobs/jobs.module';
import { MarketDataModule } from './market-data/market-data.module';
import { PrismaModule } from './prisma/prisma.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', join(__dirname, '..', '.env')],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    JobsModule,
    UsersModule,
    AccountsModule,
    CreditCardsModule,
    DashboardModule,
    CategoriesModule,
    TransactionsModule,
    FixedTransactionsModule,
    InvestmentsModule,
    GoalsModule,
    MarketDataModule,
    ImportsModule,
    BackupModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
