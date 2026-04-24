import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import { CurrentUser, UserPayload } from '../decorators/user.decorator';
import { UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  findMe(@CurrentUser() user: UserPayload) {
    return this.usersService.findById(user.sub);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: UserPayload, @Body() body: UpdateUserDto) {
    return this.usersService.updateUser(user.sub, body);
  }

  @Delete('me')
  deleteMe(@CurrentUser() user: UserPayload) {
    return this.usersService.deleteUser(user.sub);
  }
}
