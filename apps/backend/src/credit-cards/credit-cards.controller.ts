import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, UserPayload } from '../decorators/user.decorator';
import { PaginationQueryDto } from '../shared/pagination.dto';
import { CreateCreditCardDto, UpdateCreditCardDto } from './credit-cards.dto';
import { CreditCardsService } from './credit-cards.service';

@Controller('credit-cards')
export class CreditCardsController {
  constructor(private readonly creditCardsService: CreditCardsService) {}

  @Post()
  create(@CurrentUser() user: UserPayload, @Body() body: CreateCreditCardDto) {
    return this.creditCardsService.createCreditCard(user.sub, body);
  }

  @Get()
  findAll(@CurrentUser() user: UserPayload, @Query() pagination: PaginationQueryDto) {
    return this.creditCardsService.findAllByUser(user.sub, pagination.page ?? 1, pagination.limit ?? 20);
  }

  @Get(':id')
  findById(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.creditCardsService.findById(user.sub, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() body: UpdateCreditCardDto) {
    return this.creditCardsService.updateCreditCard(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.creditCardsService.deleteCreditCard(user.sub, id);
  }
}
