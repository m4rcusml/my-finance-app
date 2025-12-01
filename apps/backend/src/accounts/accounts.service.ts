import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAccountDto, UpdateAccountDto } from './accounts.dto';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) { }

  async createAccount(userId: string, dto: CreateAccountDto) {
    return await this.prisma.account.create({
      data: {
        ...dto,
        userId
      }
    })
  }

  async findAll(userId: string) {
    return await this.prisma.account.findMany({
      where: { userId }
    })
  }

  async findById(userId: string, accountId: string) {
    const response = await this.prisma.account.findUnique({
      where: { id: accountId }
    })

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    return response;
  }

  async updateAccount(userId: string, accountId: string, dto: UpdateAccountDto) {
    const response = await this.prisma.account.findUnique({
      where: { id: accountId }
    })

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    return await this.prisma.account.update({
      data: dto,
      where: { id: accountId }
    })
  }

  async deleteAccount(userId: string, accountId: string) {
    const response = await this.prisma.account.findUnique({
      where: { id: accountId }
    })

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    await this.prisma.account.delete({
      where: { id: accountId }
    })
  }
}
