import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, type UserPayload } from '../decorators/user.decorator';
import {
  CategoryResponseDto,
  CreateCategoryDto,
  ListCategoriesQueryDto,
  PaginatedCategoriesDto,
  UpdateCategoryDto,
} from './categories.dto';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Sessão inválida ou expirada.' })
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({
    summary: 'Cria uma categoria',
    description: 'O par (nome, tipo) é único por usuário; um duplicado devolve 409.',
  })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Campos inválidos.' })
  @ApiConflictResponse({ description: 'Já existe uma categoria com esse nome e tipo.' })
  create(@CurrentUser() user: UserPayload, @Body() body: CreateCategoryDto) {
    return this.categoriesService.create(user.sub, body);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista as categorias do usuário',
    description:
      'Retorna o envelope `{ data, meta }`. Por padrão traz apenas categorias ativas; use `includeArchived=true` para incluir as arquivadas e `type` para filtrar por tipo.',
  })
  @ApiOkResponse({ type: PaginatedCategoriesDto })
  findAll(@CurrentUser() user: UserPayload, @Query() query: ListCategoriesQueryDto) {
    return this.categoriesService.findAll(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma categoria' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Categoria não encontrada.' })
  findOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.categoriesService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualiza uma categoria',
    description:
      'Semântica PATCH: uma chave ausente permanece inalterada. A unicidade (nome, tipo) é validada contra o estado final.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Categoria não encontrada.' })
  @ApiConflictResponse({ description: 'Já existe uma categoria com esse nome e tipo.' })
  @ApiBadRequestResponse({ description: 'Campos inválidos.' })
  update(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() body: UpdateCategoryDto) {
    return this.categoriesService.update(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove ou arquiva uma categoria',
    description:
      'O histórico nunca é destruído. Se a categoria estiver em qualquer lançamento, lançamento fixo, ocorrência ou meta, ela é **arquivada** (`isActive=false`, `archivedAt` preenchido) e devolvida com status 200. A exclusão definitiva só acontece quando não existe nenhum vínculo.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CategoryResponseDto, description: 'Categoria arquivada ou excluída.' })
  @ApiNotFoundResponse({ description: 'Categoria não encontrada.' })
  remove(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.categoriesService.remove(user.sub, id);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Arquiva uma categoria',
    description: 'Sai dos seletores mas continua legível no histórico. Idempotente.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Categoria não encontrada.' })
  archive(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.categoriesService.archive(user.sub, id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reativa uma categoria arquivada', description: 'Idempotente.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Categoria não encontrada.' })
  restore(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.categoriesService.restore(user.sub, id);
  }
}
