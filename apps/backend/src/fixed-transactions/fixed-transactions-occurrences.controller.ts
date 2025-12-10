import { Controller, Get, Patch, Post } from '@nestjs/common';
import { CurrentUser, UserPayload } from 'src/decorators/user.decorator';
import { FixedTransactionsService } from './fixed-transactions.service';

@Controller('fixed-transactions/occurrences')
export class FixedTransactionsOccurrencesController {
  constructor(private readonly fixedTransactionsService: FixedTransactionsService) { }

  @Get()
  getAllByUser(@CurrentUser() user: UserPayload) { }

  @Patch(':id/confirm')
  update(@CurrentUser() user: UserPayload) { }

  @Patch(':id/skip')
  deactivate(@CurrentUser() user: UserPayload) { }
}
