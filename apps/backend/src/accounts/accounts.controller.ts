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
  AccountResponseDto,
  CreateAccountDto,
  ListAccountsQueryDto,
  PaginatedAccountsDto,
  UpdateAccountDto,
} from './accounts.dto';
import { AccountsService } from './accounts.service';

@ApiTags('accounts')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Sessão inválida ou expirada.' })
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({
    summary: 'Cria uma conta',
    description: 'O saldo devolvido é o saldo de abertura, já que a conta ainda não tem lançamentos.',
  })
  @ApiCreatedResponse({ type: AccountResponseDto })
  @ApiBadRequestResponse({ description: 'Campos inválidos.' })
  create(@CurrentUser() user: UserPayload, @Body() body: CreateAccountDto) {
    return this.accountsService.create(user.sub, body);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista as contas do usuário',
    description:
      'Retorna o envelope `{ data, meta }`. Por padrão traz apenas contas ativas; use `includeArchived=true` para incluir as arquivadas. O saldo de cada conta é calculado pelo banco.',
  })
  @ApiOkResponse({ type: PaginatedAccountsDto })
  findAll(@CurrentUser() user: UserPayload, @Query() query: ListAccountsQueryDto) {
    return this.accountsService.findAll(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma conta' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiNotFoundResponse({ description: 'Conta não encontrada.' })
  findOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.accountsService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualiza uma conta',
    description: 'Semântica PATCH: uma chave ausente permanece inalterada.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiNotFoundResponse({ description: 'Conta não encontrada.' })
  @ApiBadRequestResponse({ description: 'Campos inválidos.' })
  update(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() body: UpdateAccountDto) {
    return this.accountsService.update(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove ou arquiva uma conta',
    description:
      'O histórico nunca é destruído. Se a conta tiver qualquer lançamento, lançamento fixo, ocorrência ou meta vinculada, ela é **arquivada** (`isActive=false`, `archivedAt` preenchido) e devolvida com status 200. A exclusão definitiva só acontece quando não existe nenhum vínculo; nesse caso o corpo devolvido é a conta como ela era imediatamente antes da remoção.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AccountResponseDto, description: 'Conta arquivada ou excluída.' })
  @ApiNotFoundResponse({ description: 'Conta não encontrada.' })
  @ApiConflictResponse({ description: 'A conta está vinculada a registros que impedem a exclusão.' })
  remove(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.accountsService.remove(user.sub, id);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Arquiva uma conta',
    description:
      'A conta some dos seletores e dos totais do dashboard, mas continua legível para o histórico. Idempotente.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiNotFoundResponse({ description: 'Conta não encontrada.' })
  archive(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.accountsService.archive(user.sub, id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reativa uma conta arquivada', description: 'Idempotente.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiNotFoundResponse({ description: 'Conta não encontrada.' })
  restore(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.accountsService.restore(user.sub, id);
  }
}
