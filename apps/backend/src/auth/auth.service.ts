import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { User } from 'prisma/generated/client';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new NotFoundException();
    }

    const passwordMatches = await argon2.verify(user.passwordHash, password);
    if (!passwordMatches) {
      throw new UnauthorizedException();
    }

    // biome-ignore lint/correctness/noUnusedVariables: <explanation> Attribute needed to be removed from return
    const { passwordHash, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }

  async login(user: Omit<User, 'passwordHash'>): Promise<{ access_token: string }> {
    const payload = { sub: user.id, email: user.email };

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async register(email: string, password: string) {
    const userExists = await this.usersService.findByEmail(email);

    if (userExists) {
      throw new ConflictException('User already exists');
    }

    return await this.usersService.createUser({
      email,
      password,
    });
  }
}
