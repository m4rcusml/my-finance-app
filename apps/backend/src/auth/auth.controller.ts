import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser, UserPayload } from 'src/decorators/user.decorator';
import { UsersService } from 'src/users/users.service';
import { Public } from '../decorators/public.decorator';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() data: LoginDto) {
    const response = await this.authService.validateUser(data.email, data.password);

    return await this.authService.login(response);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() data: RegisterDto) {
    return await this.authService.register(data.email, data.password);
  }

  @Get('me')
  getMe(@CurrentUser() user: UserPayload) {
    return this.usersService.findById(user.sub);
  }
}
