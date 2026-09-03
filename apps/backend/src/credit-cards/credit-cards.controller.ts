import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
  CreateCreditCardDto,
  CreditCardResponseDto,
  ListCreditCardsQueryDto,
  PaginatedCreditCardsDto,
  UpdateCreditCardDto,
} from './credit-cards.dto';
import { CreditCardsService } from './credit-cards.service';

@ApiTags('credit-cards')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Sessão inválida ou expirada.' })
@Controller('credit-cards')
export class CreditCardsController {
  constructor(private readonly creditCardsService: CreditCardsService) {}

  @Post()
  @ApiOperation({
    summary: 'Cria um cartão de crédito',
    description: 'Devolve exatamente a mesma representação do GET, incluindo `currentCycle`.',
  })
  @ApiCreatedResponse({ type: CreditCardResponseDto })
  @ApiBadRequestResponse({ description: 'Campos inválidos.' })
  create(@CurrentUser() user: UserPayload, @Body() body: CreateCreditCardDto) {
    return this.creditCardsService.create(user.sub, body);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista os cartões do usuário',
    description:
      'Retorna o envelope `{ data, meta }`. `cycleUsedAmount` considera **apenas** as despesas do ciclo aberto atual, delimitado por `closingDay` (`null` = mês civil). Use `includeArchived=true` para incluir cartões arquivados.',
  })
  @ApiOkResponse({ type: PaginatedCreditCardsDto })
  findAll(@CurrentUser() user: UserPayload, @Query() query: ListCreditCardsQueryDto) {
    return this.creditCardsService.findAll(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um cartão de crédito' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CreditCardResponseDto })
  @ApiNotFoundResponse({ description: 'Cartão não encontrado.' })
  findOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.creditCardsService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualiza um cartão de crédito',
    description:
      'Semântica PATCH: uma chave ausente permanece inalterada e `closingDay: null` limpa o dia de fechamento (o ciclo volta a ser o mês civil). A resposta tem a mesma forma do GET.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CreditCardResponseDto })
  @ApiNotFoundResponse({ description: 'Cartão não encontrado.' })
  @ApiBadRequestResponse({ description: 'Campos inválidos.' })
  update(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() body: UpdateCreditCardDto) {
    return this.creditCardsService.update(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove ou arquiva um cartão',
    description:
      'O histórico nunca é destruído. Se o cartão tiver qualquer lançamento, lançamento fixo ou ocorrência, ele é **arquivado** (`isActive=false`, `archivedAt` preenchido) e devolvido com status 200. A exclusão definitiva só acontece quando não existe nenhum vínculo.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CreditCardResponseDto, description: 'Cartão arquivado ou excluído.' })
  @ApiNotFoundResponse({ description: 'Cartão não encontrado.' })
  remove(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.creditCardsService.remove(user.sub, id);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Arquiva um cartão',
    description: 'O cartão sai dos seletores e dos totais, mas continua legível no histórico. Idempotente.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CreditCardResponseDto })
  @ApiNotFoundResponse({ description: 'Cartão não encontrado.' })
  archive(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.creditCardsService.archive(user.sub, id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reativa um cartão arquivado', description: 'Idempotente.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CreditCardResponseDto })
  @ApiNotFoundResponse({ description: 'Cartão não encontrado.' })
  restore(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.creditCardsService.restore(user.sub, id);
  }
}
