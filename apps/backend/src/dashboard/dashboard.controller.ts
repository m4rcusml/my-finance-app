import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, UserPayload } from 'src/decorators/user.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @Get()
  async getDashboard(@CurrentUser() user: UserPayload, @Query('referenceDate') referenceDate?: string) {
    return await this.dashboardService.getOverview(user.sub, referenceDate);
  }
}
