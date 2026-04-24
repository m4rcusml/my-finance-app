import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({
  providers: [BackupService],
  controllers: [BackupController],
})
export class BackupModule {}
