import type { OccurrenceWithTemplate, PaginatedResponse } from '@finance/contracts';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, type UserPayload } from '../decorators/user.decorator';
import {
  ConfirmOccurrenceDto,
  ListOccurrencesQueryDto,
  OccurrenceWithTemplateResponseDto,
  PaginatedOccurrencesDto,
} from './fixed-transactions.dto';
import { FixedTransactionsOccurrencesService } from './fixed-transactions-occurrences.service';

/**
 * Registered *before* `FixedTransactionsController` in the module so that
 * `GET /fixed-transactions/occurrences` is matched before the sibling
 * `GET /fixed-transactions/:id` route can swallow it.
 */
@ApiTags('Lançamentos fixos')
@ApiBearerAuth('access-token')
@Controller('fixed-transactions/occurrences')
export class FixedTransactionsOccurrencesController {
  constructor(private readonly occurrencesService: FixedTransactionsOccurrencesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista ocorrências geradas pelos templates.',
    description:
      '`year` e `month` são opcionais; omiti-los devolve todas as competências, da mais recente para a mais antiga.',
  })
  @ApiOkResponse({ type: PaginatedOccurrencesDto })
  list(
    @CurrentUser() user: UserPayload,
    @Query() query: ListOccurrencesQueryDto,
  ): Promise<PaginatedResponse<OccurrenceWithTemplate>> {
    return this.occurrencesService.list(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma ocorrência.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OccurrenceWithTemplateResponseDto })
  @ApiNotFoundResponse({ description: 'Ocorrência não encontrada.' })
  findOne(
    @CurrentUser() user: UserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<OccurrenceWithTemplate> {
    return this.occurrencesService.findOne(user.sub, id);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirma a ocorrência e cria a transação correspondente.',
    description:
      'Idempotente sob concorrência: a primeira requisição vence e as demais recebem 409, de modo que um período nunca gera duas transações.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OccurrenceWithTemplateResponseDto })
  @ApiBadRequestResponse({ description: '`realDate` fora da janela permitida.' })
  @ApiNotFoundResponse({ description: 'Ocorrência não encontrada.' })
  @ApiConflictResponse({ description: 'Ocorrência já confirmada ou ignorada.' })
  confirm(
    @CurrentUser() user: UserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ConfirmOccurrenceDto,
  ): Promise<OccurrenceWithTemplate> {
    return this.occurrencesService.confirm(user.sub, id, body);
  }

  @Post(':id/skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marca a ocorrência como ignorada, sem criar transação.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OccurrenceWithTemplateResponseDto })
  @ApiNotFoundResponse({ description: 'Ocorrência não encontrada.' })
  @ApiConflictResponse({ description: 'Ocorrência já confirmada ou ignorada.' })
  skip(
    @CurrentUser() user: UserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<OccurrenceWithTemplate> {
    return this.occurrencesService.skip(user.sub, id);
  }
}
