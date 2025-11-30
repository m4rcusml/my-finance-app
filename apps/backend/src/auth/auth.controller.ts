import { Body, Controller, Get, HttpCode, HttpStatus, Post, Request, UseGuards } from '@nestjs/common';
import { User } from 'prisma/generated/client';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async signIn(@Body() data: Record<string, string>) {
    const response = await this.authService.validateUser(data.email, data.password)
    
    return await this.authService.login(response);
  }

  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  async register(@Body() data: Record<string, string>) {
    await this.authService.register(data.email, data.password)
  }

  // @UseGuards(AuthGuard) ver se o auth guard está global
  @Get('me')
  getMe() {
    // incompleta
    return 'oi';
  }
}
