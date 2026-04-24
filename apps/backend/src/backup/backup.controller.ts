import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser, UserPayload } from '../decorators/user.decorator';
import { RestoreBackupDto } from './backup.dto';
import { BackupService } from './backup.service';

@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('export')
  async export(@CurrentUser() user: UserPayload) {
    return await this.backupService.export(user.sub);
  }

  @Post('import')
  async restore(@CurrentUser() user: UserPayload, @Body() dto: RestoreBackupDto) {
    return await this.backupService.restore(user.sub, dto.data as any);
  }
}
