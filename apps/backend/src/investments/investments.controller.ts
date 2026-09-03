import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, type UserPayload } from '../decorators/user.decorator';
import {
  CreateInvestmentDto,
  InvestmentResponseDto,
  ListInvestmentsQueryDto,
  PaginatedInvestmentsDto,
  PortfolioSummaryDto,
  UpdateInvestmentDto,
} from './investments.dto';
import { InvestmentsService } from './investments.service';

/**
 * Carteira manual de investimentos.
 *
 * Registra apenas o custo de aquisição (quantidade, preço pago e data da
 * compra). A V1 não consulta cotações, portanto nenhuma rota devolve valor
 * atual, lucro ou rentabilidade.
 */
@ApiTags('investments')
@ApiBearerAuth('access-token')
@Controller('investments')
export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Registra um investimento',
    description: 'investedAmount é opcional: quando omitido vale quantity × buyPrice arredondado em 2 casas.',
  })
  @ApiCreatedResponse({ type: InvestmentResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos ou investedAmount incompatível com quantity × buyPrice.' })
  @ApiNotFoundResponse({ description: 'Ativo não encontrado.' })
  create(@CurrentUser() user: UserPayload, @Body() body: CreateInvestmentDto) {
    return this.investmentsService.create(user.sub, body);
  }

  @Get()
  @ApiOperation({ summary: 'Lista investimentos', description: 'Aceita filtros por type e marketAssetId.' })
  @ApiOkResponse({ type: PaginatedInvestmentsDto })
  findAll(@CurrentUser() user: UserPayload, @Query() query: ListInvestmentsQueryDto) {
    return this.investmentsService.findAll(user.sub, query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Resumo da carteira por custo de aquisição',
    description:
      'Somente custo: a V1 não tem preços, então não há valor atual, lucro nem rentabilidade neste resumo.',
  })
  @ApiOkResponse({ type: PortfolioSummaryDto })
  getSummary(@CurrentUser() user: UserPayload) {
    return this.investmentsService.getPortfolioSummary(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um investimento' })
  @ApiOkResponse({ type: InvestmentResponseDto })
  @ApiNotFoundResponse({ description: 'Investimento não encontrado.' })
  findOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.investmentsService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualiza um investimento',
    description: 'Chaves omitidas ficam intactas; marketAssetId igual a null desvincula o ativo.',
  })
  @ApiOkResponse({ type: InvestmentResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos ou investedAmount incompatível com quantity × buyPrice.' })
  @ApiNotFoundResponse({ description: 'Investimento ou ativo não encontrado.' })
  update(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() body: UpdateInvestmentDto) {
    return this.investmentsService.update(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui um investimento' })
  @ApiNoContentResponse({ description: 'Investimento excluído.' })
  @ApiNotFoundResponse({ description: 'Investimento não encontrado.' })
  remove(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.investmentsService.remove(user.sub, id);
  }
}
