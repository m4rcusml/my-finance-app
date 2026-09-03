import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Deliberately does NOT import `AuthModule`: `AuthModule` imports this one, and
 * session revocation on a password change is done here through Prisma rather
 * than by calling back into `AuthService`, which keeps the dependency acyclic.
 */
@Module({
  imports: [PrismaModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
