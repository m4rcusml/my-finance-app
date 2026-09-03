import type {
  ExpenseProjection,
  PaginatedResponse,
  Transaction,
  TransactionSummary,
  TransactionWithRelations,
} from '@finance/contracts';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, type UserPayload } from '../decorators/user.decorator';
import {
  CreateTransactionDto,
  ExpenseProjectionDto,
  ExpenseProjectionQueryDto,
  ListTransactionsQueryDto,
  PaginatedTransactionsDto,
  TransactionDto,
  TransactionSummaryDto,
  TransactionSummaryQueryDto,
  UpdateTransactionDto,
} from './transactions.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('Lançamentos')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Sessão inválida ou expirada.' })
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({
    summary: 'Cria um lançamento',
    description: 'Exatamente uma origem: informe accountId **ou** creditCardId, nunca os dois e nunca nenhum.',
  })
  @ApiCreatedResponse({ type: TransactionDto })
  @ApiBadRequestResponse({ description: 'Origem inválida, data inválida ou conta/cartão/categoria arquivados.' })
  @ApiNotFoundResponse({ description: 'Conta, cartão ou categoria não encontrados.' })
  create(@CurrentUser() user: UserPayload, @Body() body: CreateTransactionDto): Promise<Transaction> {
    return this.transactionsService.create(user.sub, body);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista lançamentos',
    description: 'Ordem estável (data, criação, id) e filtros combináveis. `toDate` inclui o dia inteiro.',
  })
  @ApiOkResponse({ type: PaginatedTransactionsDto })
  @ApiBadRequestResponse({ description: 'Filtro inválido.' })
  findAll(
    @CurrentUser() user: UserPayload,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<PaginatedResponse<TransactionWithRelations>> {
    return this.transactionsService.findAllByUser(user.sub, query);
  }

  @Get('uncategorized')
  @ApiOperation({ summary: 'Lista lançamentos sem categoria', description: 'Mesmos filtros da listagem principal.' })
  @ApiOkResponse({ type: PaginatedTransactionsDto })
  @ApiBadRequestResponse({ description: 'Filtro inválido.' })
  findUncategorized(
    @CurrentUser() user: UserPayload,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<PaginatedResponse<TransactionWithRelations>> {
    return this.transactionsService.findUncategorized(user.sub, query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Resumo do período',
    description: 'Entradas, saídas e saldo entre `from` e `to`, ambos obrigatórios e inclusivos.',
  })
  @ApiOkResponse({ type: TransactionSummaryDto })
  @ApiBadRequestResponse({ description: '`from`/`to` ausentes, inválidos ou invertidos.' })
  getSummary(
    @CurrentUser() user: UserPayload,
    @Query() query: TransactionSummaryQueryDto,
  ): Promise<TransactionSummary> {
    return this.transactionsService.getSummary(user.sub, query.from, query.to);
  }

  @Get('projection')
  @ApiOperation({
    summary: 'Projeção de despesa mensal',
    description: 'Média dos últimos meses **completos**; o mês corrente, ainda parcial, fica de fora.',
  })
  @ApiOkResponse({ type: ExpenseProjectionDto })
  @ApiBadRequestResponse({ description: '`months` fora do intervalo permitido.' })
  getProjection(
    @CurrentUser() user: UserPayload,
    @Query() query: ExpenseProjectionQueryDto,
  ): Promise<ExpenseProjection> {
    return this.transactionsService.getProjection(user.sub, query.months);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um lançamento' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TransactionDto })
  @ApiNotFoundResponse({ description: 'Lançamento não encontrado.' })
  findById(@CurrentUser() user: UserPayload, @Param('id') id: string): Promise<Transaction> {
    return this.transactionsService.findById(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualiza um lançamento',
    description: 'Campo ausente fica como está; `null` limpa a relação. A origem única é validada no estado final.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TransactionDto })
  @ApiBadRequestResponse({
    description: 'Resultado ficaria sem origem, com duas origens, ou aponta para item arquivado.',
  })
  @ApiNotFoundResponse({ description: 'Lançamento, conta, cartão ou categoria não encontrados.' })
  update(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() body: UpdateTransactionDto,
  ): Promise<Transaction> {
    return this.transactionsService.update(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Exclui um lançamento',
    description: 'Lançamento gerado por recorrência confirmada é histórico: desfaça a ocorrência antes.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Lançamento excluído.' })
  @ApiNotFoundResponse({ description: 'Lançamento não encontrado.' })
  @ApiConflictResponse({ description: 'Lançamento vinculado a uma ocorrência de recorrência confirmada.' })
  remove(@CurrentUser() user: UserPayload, @Param('id') id: string): Promise<void> {
    return this.transactionsService.remove(user.sub, id);
  }
}
