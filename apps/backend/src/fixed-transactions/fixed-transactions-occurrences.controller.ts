import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser, UserPayload } from 'src/decorators/user.decorator';
import { ConfirmOccurrenceDto } from './fixed-transactions.dto';
import { FixedTransactionsOccurrencesService } from './fixed-transactions-occurrences.service';

@Controller('fixed-transactions/occurrences')
export class FixedTransactionsOccurrencesController {
  constructor(private readonly fixedTransactionsOccurrencesService: FixedTransactionsOccurrencesService) { }

  @Get()
  async getAllByUser(
    @CurrentUser() user: UserPayload,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('status') status: 'PENDING' | 'CONFIRMED' | 'SKIPPED'
  ) {
    return await this.fixedTransactionsOccurrencesService.listAllByUser(
      user.sub,
      { year: Number(year), month: Number(month), status }
    );
  }

  @Patch(':id/confirm')
  async update(@CurrentUser() user: UserPayload, @Param('id') occurrenceId: string, @Body() dto: ConfirmOccurrenceDto) {
    return await this.fixedTransactionsOccurrencesService.confirmOccurrence(user.sub, occurrenceId, dto.realDate);
  }

  @Patch(':id/skip')
  async deactivate(@CurrentUser() user: UserPayload, @Param('id') occurrenceId: string) {
    return await this.fixedTransactionsOccurrencesService.skipOccurrence(user.sub, occurrenceId);
  }
}
