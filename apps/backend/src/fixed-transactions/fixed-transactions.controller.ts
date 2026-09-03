import type { FixedTransaction, PaginatedResponse } from '@finance/contracts';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, type UserPayload } from '../decorators/user.decorator';
import {
  CreateFixedTransactionDto,
  FixedTransactionResponseDto,
  ListFixedTransactionsQueryDto,
  PaginatedFixedTransactionsDto,
  UpdateFixedTransactionDto,
} from './fixed-transactions.dto';
import { FixedTransactionsService } from './fixed-transactions.service';

@ApiTags('Lançamentos fixos')
@ApiBearerAuth('access-token')
@Controller('fixed-transactions')
export class FixedTransactionsController {
  constructor(private readonly fixedTransactionsService: FixedTransactionsService) {}

  @Post()
  @ApiOperation({
    summary: 'Cria um template de recorrência.',
    description: 'Informe exatamente uma origem: `accountId` (débito em conta) ou `creditCardId` (cartão).',
  })
  @ApiCreatedResponse({ type: FixedTransactionResponseDto })
  @ApiBadRequestResponse({ description: 'Payload inválido ou origem ambígua.' })
  @ApiNotFoundResponse({ description: 'Categoria, conta ou cartão inexistente.' })
  create(@CurrentUser() user: UserPayload, @Body() body: CreateFixedTransactionDto): Promise<FixedTransaction> {
    return this.fixedTransactionsService.create(user.sub, body);
  }

  @Get()
  @ApiOperation({ summary: 'Lista os templates de recorrência do usuário.' })
  @ApiOkResponse({ type: PaginatedFixedTransactionsDto })
  findAll(
    @CurrentUser() user: UserPayload,
    @Query() query: ListFixedTransactionsQueryDto,
  ): Promise<PaginatedResponse<FixedTransaction>> {
    return this.fixedTransactionsService.findAll(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um template de recorrência.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FixedTransactionResponseDto })
  @ApiNotFoundResponse({ description: 'Lançamento fixo não encontrado.' })
  findOne(
    @CurrentUser() user: UserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<FixedTransaction> {
    return this.fixedTransactionsService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualiza um template de recorrência.',
    description:
      'Campos omitidos permanecem como estão; `null` limpa a origem opcional. A alteração vale apenas para ocorrências pendentes de períodos futuros.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FixedTransactionResponseDto })
  @ApiBadRequestResponse({ description: 'Estado final inválido (nenhuma ou duas origens).' })
  @ApiNotFoundResponse({ description: 'Lançamento fixo não encontrado.' })
  update(
    @CurrentUser() user: UserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateFixedTransactionDto,
  ): Promise<FixedTransaction> {
    return this.fixedTransactionsService.update(user.sub, id, body);
  }

  @Post(':id/archive')
  @ApiOperation({
    summary: 'Arquiva um template de recorrência.',
    description: 'O histórico é preservado; apenas ocorrências pendentes de períodos futuros são descartadas.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FixedTransactionResponseDto })
  @ApiNotFoundResponse({ description: 'Lançamento fixo não encontrado.' })
  archive(
    @CurrentUser() user: UserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<FixedTransaction> {
    return this.fixedTransactionsService.archive(user.sub, id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Reativa um template arquivado.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FixedTransactionResponseDto })
  @ApiNotFoundResponse({ description: 'Lançamento fixo não encontrado.' })
  restore(
    @CurrentUser() user: UserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<FixedTransaction> {
    return this.fixedTransactionsService.restore(user.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Arquiva o template (equivalente a POST /:id/archive).',
    description: 'Não existe exclusão definitiva: a FK das ocorrências é RESTRICT justamente para o histórico sobreviver.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Template arquivado.' })
  @ApiNotFoundResponse({ description: 'Lançamento fixo não encontrado.' })
  remove(
    @CurrentUser() user: UserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.fixedTransactionsService.remove(user.sub, id);
  }
}
