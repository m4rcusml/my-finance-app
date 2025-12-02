import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, UserPayload } from 'src/decorators/user.decorator';
import { CreateTransactionDto, ListTransactionsQueryDto, UpdateTransactionDto } from './transactions.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionService: TransactionsService) { }

  @Post()
  async create(@CurrentUser() user: UserPayload, @Body() dto: CreateTransactionDto) {
    return await this.transactionService.create(user.sub, dto);
  }

  @Get()
  async findAll(@CurrentUser() user: UserPayload, @Query() filters: ListTransactionsQueryDto) {
    return await this.transactionService.findAll(user.sub, filters);
  }

  @Get('uncategorized')
  async findUncategorized(@CurrentUser() user: UserPayload, @Query() filters: ListTransactionsQueryDto) {
    return await this.transactionService.findUncategorized(user.sub, filters);
  }

  @Get(':id')
  async findById(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return await this.transactionService.findById(user.sub, id);
  }

  @Patch(':id')
  async update(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return await this.transactionService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return await this.transactionService.delete(user.sub, id);
  }
}
