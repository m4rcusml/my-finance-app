import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountsModule } from './accounts/accounts.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FixedTransactionsModule } from './fixed-transactions/fixed-transactions.module';
import { JobsModule } from './jobs/jobs.module';
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
    DashboardModule,
    CategoriesModule,
    TransactionsModule,
    FixedTransactionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
