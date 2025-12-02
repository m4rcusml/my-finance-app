import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, UserPayload } from 'src/decorators/user.decorator';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) { }

  @Post()
  create(@CurrentUser() user: UserPayload, @Body() body: CreateCategoryDto) {
    return this.categoriesService.create(user.sub, body);
  }

  @Get()
  findAll(@CurrentUser() user: UserPayload) {
    return this.categoriesService.findAll(user.sub);
  }

  @Get(':id')
  findById(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.categoriesService.findById(user.sub, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() body: UpdateCategoryDto) {
    return this.categoriesService.update(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.categoriesService.delete(user.sub, id);
  }
}
