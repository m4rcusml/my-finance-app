import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Prisma } from 'prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(userId: string) {
    const response = this.prisma.user.findUnique({
      where: { id: userId },
      omit: { passwordHash: true },
    });

    return response;
  }

  findByEmail(email: string) {
    const response = this.prisma.user.findUnique({
      where: { email },
    });

    return response;
  }

  async createUser({ email, password }: { email: string; password: string }) {
    const passwordHash = await argon2.hash(password);

    return await this.prisma.user.create({
      data: {
        email,
        passwordHash,
      },
      omit: { passwordHash: true },
    });
  }

  listUsers(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.UserWhereUniqueInput;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }) {
    const { skip, take, cursor, where, orderBy } = params;

    return this.prisma.user.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      omit: { passwordHash: true },
    });
  }
}
