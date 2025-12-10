import { Controller, Get, Patch, Post } from '@nestjs/common';
import { CurrentUser, UserPayload } from 'src/decorators/user.decorator';
import { FixedTransactionsService } from './fixed-transactions.service';

@Controller('fixed-transactions')
export class FixedTransactionsController {
  constructor(private readonly fixedTransactionsService: FixedTransactionsService) { }

  @Post()
  create(@CurrentUser() user: UserPayload) { }

  @Get()
  getAllByUser(@CurrentUser() user: UserPayload) { }

  @Get(':id')
  getById(@CurrentUser() user: UserPayload) { }

  @Patch(':id')
  update(@CurrentUser() user: UserPayload) { }

  @Patch(':id/deactivate')
  deactivate(@CurrentUser() user: UserPayload) { }
}
