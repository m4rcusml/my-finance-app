import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'node:path';
import { AccountsModule } from './accounts/accounts.module';
import { AuthModule } from './auth/auth.module';
import { BackupModule } from './backup/backup.module';
import { CategoriesModule } from './categories/categories.module';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { validateEnv } from './config/env';
import { CreditCardsModule } from './credit-cards/credit-cards.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FixedTransactionsModule } from './fixed-transactions/fixed-transactions.module';
import { GoalsModule } from './goals/goals.module';
import { HealthModule } from './health/health.module';
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
      cache: true,
      // Fails fast with a named list of problems; never prints values.
      validate: validateEnv,
      envFilePath: ['.env', join(__dirname, '..', '.env')],
    }),
    // Global floor. Auth routes add their own much tighter limit.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'global', ttl: 60_000, limit: 300 }],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
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
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  constructor(private readonly config: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
