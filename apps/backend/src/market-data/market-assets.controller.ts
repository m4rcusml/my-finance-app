import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/pagination.dto';
import { CurrentUser, type UserPayload } from '../decorators/user.decorator';
import {
  CreateMarketAssetDto,
  MarketAssetResponseDto,
  PaginatedMarketAssetsDto,
  UpdateMarketAssetDto,
} from './market-assets.dto';
import { MarketAssetsService } from './market-assets.service';

/**
 * Catálogo manual de ativos.
 *
 * Cada linha é apenas um rótulo cadastrado pelo próprio usuário (símbolo,
 * classe, bolsa e um nome opcional) para que os investimentos possam apontar
 * para ele. A V1 **não consulta cotações, não guarda preços e não guarda
 * histórico** — nada aqui é dado de mercado.
 */
@ApiTags('market-assets')
@ApiBearerAuth('access-token')
@Controller('market-assets')
export class MarketAssetsController {
  constructor(private readonly marketAssetsService: MarketAssetsService) {}

  @Post()
  @ApiOperation({
    summary: 'Cadastra um ativo no catálogo manual',
    description: 'O símbolo é normalizado para maiúsculas. Não há consulta de cotação.',
  })
  @ApiCreatedResponse({ type: MarketAssetResponseDto })
  @ApiConflictResponse({ description: 'Já existe um ativo com esse símbolo nesta bolsa.' })
  create(@CurrentUser() user: UserPayload, @Body() body: CreateMarketAssetDto) {
    return this.marketAssetsService.create(user.sub, body);
  }

  @Get()
  @ApiOperation({ summary: 'Lista o catálogo de ativos do usuário' })
  @ApiOkResponse({ type: PaginatedMarketAssetsDto })
  findAll(@CurrentUser() user: UserPayload, @Query() query: PaginationQueryDto) {
    return this.marketAssetsService.findAll(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um ativo do catálogo' })
  @ApiOkResponse({ type: MarketAssetResponseDto })
  @ApiNotFoundResponse({ description: 'Ativo não encontrado.' })
  findOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.marketAssetsService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um ativo do catálogo', description: 'Chaves omitidas ficam intactas.' })
  @ApiOkResponse({ type: MarketAssetResponseDto })
  @ApiNotFoundResponse({ description: 'Ativo não encontrado.' })
  @ApiConflictResponse({ description: 'Já existe um ativo com esse símbolo nesta bolsa.' })
  update(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() body: UpdateMarketAssetDto,
  ) {
    return this.marketAssetsService.update(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Exclui um ativo do catálogo',
    description: 'Recusado quando existe investimento apontando para o ativo.',
  })
  @ApiNoContentResponse({ description: 'Ativo excluído.' })
  @ApiNotFoundResponse({ description: 'Ativo não encontrado.' })
  @ApiConflictResponse({ description: 'Ativo em uso por investimentos e não pode ser excluído.' })
  remove(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.marketAssetsService.remove(user.sub, id);
  }
}
