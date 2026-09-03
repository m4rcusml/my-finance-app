import { Module } from '@nestjs/common';
import { ImportFilePipe } from './import-file.pipe';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

/**
 * No `TransactionsModule` here on purpose: confirm writes its transactions
 * inside its own `$transaction` so that the `ImportedFile` and every row it
 * produced commit or roll back together. Going through `TransactionsService`
 * meant one autocommitted INSERT per row, and a failure halfway through left
 * half an import behind with no way to tell.
 */
@Module({
  controllers: [ImportsController],
  providers: [ImportsService, ImportFilePipe],
  exports: [ImportsService],
})
export class ImportsModule {}
