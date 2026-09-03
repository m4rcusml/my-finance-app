import type { DashboardOverview } from '@finance/contracts';
import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, type UserPayload } from '../decorators/user.decorator';
import { DashboardOverviewDto, DashboardQueryDto } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Painel consolidado do usuário',
    description: [
      'Retorna saldos, totais da janela, listas curtas e a série anual em uma única chamada.',
      '',
      '**Janelas** (todos os limites são inclusivos):',
      '- `week`: segunda a domingo que contém `referenceDate`.',
      '- `month` (padrão): do dia 1 ao último dia do mês de `referenceDate`.',
      '- `year`: de 1º de janeiro a 31 de dezembro do ano de `referenceDate`.',
      '- `custom`: exatamente `from..to`; ambos são obrigatórios e `from` não pode ser maior que `to`.',
      '',
      '`referenceDate` usa hoje no fuso configurado (`APP_TIMEZONE`) quando omitido.',
      '',
      '`totals.previous` é a janela imediatamente anterior: mês e ano comparam com o mês/ano civil anterior;',
      'semana e período personalizado deslocam a janela pelo seu próprio tamanho em dias.',
      '`totals.netBalance` considera apenas contas que não são do tipo `investment`;',
      'o saldo dessas contas aparece em `totals.investedAccountBalance`.',
      '`annualBalance` traz sempre 12 meses terminando no mês de referência, com meses sem movimento zerados.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: DashboardOverviewDto, description: 'Painel consolidado.' })
  @ApiBadRequestResponse({ description: 'Data civil inválida, ou `period=custom` sem `from`/`to` válidos.' })
  @ApiUnauthorizedResponse({ description: 'Sessão inválida ou expirada.' })
  getOverview(@CurrentUser() user: UserPayload, @Query() query: DashboardQueryDto): Promise<DashboardOverview> {
    return this.dashboardService.getOverview(user.sub, query);
  }
}
