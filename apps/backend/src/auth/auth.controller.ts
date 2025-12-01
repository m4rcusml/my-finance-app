import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from 'src/users/users.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

interface RequestWithUser extends Request {
  user: {
    sub: string;
    email: string;
    iat: number;
    exp: number;
  };
}

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
  getMe(@Req() req: RequestWithUser) {
    return this.usersService.findById(req.user.sub);
  }
}
