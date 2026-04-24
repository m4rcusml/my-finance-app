import { Module } from '@nestjs/common';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [TransactionsModule],
  providers: [ImportsService],
  controllers: [ImportsController],
})
export class ImportsModule {}
