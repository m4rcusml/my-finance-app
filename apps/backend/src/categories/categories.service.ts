import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) { }

  async create(userId: string, dto: CreateCategoryDto) {
    return await this.prisma.category.create({
      data: {
        ...dto,
        userId
      }
    })
  }

  async findAll(userId: string) {
    return await this.prisma.category.findMany({
      where: { userId }
    })
  }

  async findById(userId: string, categoryId: string) {
    const response = await this.prisma.category.findUnique({
      where: { id: categoryId }
    })

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    return response;
  }

  async update(userId: string, categoryId: string, dto: UpdateCategoryDto) {
    const response = await this.prisma.category.findUnique({
      where: { id: categoryId }
    })

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    return await this.prisma.category.update({
      data: dto,
      where: { id: categoryId }
    })
  }

  async delete(userId: string, categoryId: string) {
    const response = await this.prisma.category.findUnique({
      where: { id: categoryId }
    })

    if (!response) {
      throw new NotFoundException();
    }

    if (response.userId !== userId) {
      throw new ForbiddenException();
    }

    // verificar transactions dependentes

    await this.prisma.category.delete({
      where: { id: categoryId }
    })
  }
}
