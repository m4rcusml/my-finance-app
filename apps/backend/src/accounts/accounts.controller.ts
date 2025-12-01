import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, UserPayload } from '../decorators/user.decorator';
import { CreateAccountDto, UpdateAccountDto } from './accounts.dto';
import { AccountsService } from './accounts.service';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(@CurrentUser() user: UserPayload, @Body() body: CreateAccountDto) {
    return this.accountsService.createAccount(user.sub, body);
  }

  @Get()
  findAll(@CurrentUser() user: UserPayload) {
    return this.accountsService.findAll(user.sub);
  }

  @Get(':id')
  findById(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.accountsService.findById(user.sub, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() body: UpdateAccountDto) {
    return this.accountsService.updateAccount(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.accountsService.deleteAccount(user.sub, id);
  }
}
