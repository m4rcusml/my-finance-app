import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { EnvConfig } from '../config/env';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      // Global so the guard can be injected anywhere without re-importing.
      global: true,
      imports: [ConfigModule],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        // `validateEnv` already guaranteed this is present and >= 32 chars, so
        // there is no fallback default that could silently sign real tokens.
        secret: config.get('JWT_SECRET', { infer: true }),
        // A number is interpreted as seconds by jsonwebtoken.
        signOptions: { expiresIn: config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true }) },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    // Registered globally: every route is authenticated unless it says
    // `@Public()`. Forgetting the decorator locks a route down, never opens it.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
