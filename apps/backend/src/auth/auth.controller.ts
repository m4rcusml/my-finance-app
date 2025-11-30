import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() data: Record<string, string>) {
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
  getMe() {
    return 'oi';
  }
}
