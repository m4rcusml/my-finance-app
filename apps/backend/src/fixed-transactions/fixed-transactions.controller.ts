import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, UserPayload } from 'src/decorators/user.decorator';
import { FixedTransactionsService } from './fixed-transactions.service';
import { CreateFixedTransactionDto, UpdateFixedTransactionDto } from './fixed-transactions.dto';

@Controller('fixed-transactions')
export class FixedTransactionsController {
  constructor(private readonly fixedTransactionsService: FixedTransactionsService) { }

  @Post()
  async create(@CurrentUser() user: UserPayload, @Body() dto: CreateFixedTransactionDto) {
    return await this.fixedTransactionsService.createFixedTransaction(user.sub, dto);
  }

  @Get()
  async getAllByUser(@CurrentUser() user: UserPayload) {
    return await this.fixedTransactionsService.findAllByUser(user.sub);
  }

  @Get(':id')
  async getById(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return await this.fixedTransactionsService.findById(user.sub, id);
  }

  @Patch(':id')
  async update(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() dto: UpdateFixedTransactionDto) {
    return await this.fixedTransactionsService.updateFixedTransaction(user.sub, id, dto)
  }

  @Patch(':id/deactivate')
  async deactivate(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return await this.fixedTransactionsService.toggleActive(user.sub, id, false);
  }
}
