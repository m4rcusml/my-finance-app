import type { HealthResponse, ReadinessResponse } from '@finance/contracts';
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Liveness and readiness. Both are public and mounted OUTSIDE the `/api/v1`
 * prefix so a load balancer can reach them without knowing the API version,
 * and neither reveals versions, hostnames or connection strings.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Processo está vivo (não toca o banco).' })
  @ApiOkResponse({ schema: { example: { status: 'ok', uptimeSeconds: 42 } } })
  live(): HealthResponse {
    return { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) };
  }

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pronto para receber tráfego (verifica o banco).' })
  @ApiOkResponse({ schema: { example: { status: 'ok', checks: { database: 'ok' } } } })
  @ApiServiceUnavailableResponse({ description: 'Banco indisponível.' })
  async ready(): Promise<ReadinessResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', checks: { database: 'ok' } };
    } catch {
      // No driver text in the body — the reason is in the server log.
      return { status: 'error', checks: { database: 'error' } };
    }
  }
}
