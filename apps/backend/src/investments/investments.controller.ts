import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, UserPayload } from 'src/decorators/user.decorator';
import { PaginationQueryDto } from '../shared/pagination.dto';
import { CreateInvestmentDto, UpdateInvestmentDto } from './investments.dto';
import { InvestmentsService } from './investments.service';

@Controller('investments')
export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  @Post()
  create(@CurrentUser() user: UserPayload, @Body() body: CreateInvestmentDto) {
    return this.investmentsService.createInvestment(user.sub, body);
  }

  @Get()
  findAll(@CurrentUser() user: UserPayload, @Query() pagination: PaginationQueryDto) {
    return this.investmentsService.findAllByUser(user.sub, pagination.page ?? 1, pagination.limit ?? 20);
  }

  @Get(':id')
  findById(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.investmentsService.findById(user.sub, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() body: UpdateInvestmentDto) {
    return this.investmentsService.updateInvestment(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.investmentsService.deleteInvestment(user.sub, id);
  }
}
