import type { BackupFile, RestoreResponse } from '@finance/contracts';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, UserPayload } from '../decorators/user.decorator';
import { BackupFileDto, RestoreBackupDto, RestoreResponseDto } from './backup.dto';
import { BackupService } from './backup.service';

@ApiTags('backup')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Sessão inválida ou expirada.' })
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('export')
  @ApiOperation({
    summary: 'Exporta todos os dados da conta',
    description:
      'Devolve o arquivo versionado (`schemaVersion 1`) com contas, cartões, categorias, transações, ' +
      'lançamentos fixos e suas ocorrências, ativos, investimentos, metas e histórico de importações. ' +
      'O bloco `user` traz apenas e-mail e nome — nenhuma credencial é exportada.',
  })
  @ApiOkResponse({ type: BackupFileDto, description: 'Arquivo de backup, servido como download.' })
  @ApiPayloadTooLargeResponse({ description: 'A conta tem registros demais para um único arquivo.' })
  async exportBackup(
    @CurrentUser() user: UserPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BackupFile> {
    const file = await this.backupService.exportBackup(user.sub);
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${this.backupService.exportFileName()}"`);
    return file;
  }

  @Post('restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restaura um arquivo de backup',
    description:
      'Valida o arquivo inteiro antes de escrever qualquer linha e aplica tudo em uma única transação: ' +
      'se algo falhar, nada é gravado. Em `replace` os registros atuais são apagados e o arquivo é ' +
      'restaurado por completo — repetir a mesma restauração leva ao mesmo estado. Em `merge` nada é ' +
      'apagado e transações com `externalId` já existente são ignoradas.',
  })
  @ApiBody({ type: RestoreBackupDto })
  @ApiOkResponse({ type: RestoreResponseDto, description: 'Contagem do que foi criado e removido.' })
  @ApiUnprocessableEntityResponse({
    description: 'Arquivo inválido: versão não suportada ou problemas listados em `details`.',
  })
  @ApiPayloadTooLargeResponse({ description: 'Arquivo maior que o limite configurado.' })
  async restore(@CurrentUser() user: UserPayload, @Body() body: RestoreBackupDto): Promise<RestoreResponse> {
    return await this.backupService.restoreBackup(user.sub, body.mode, body.data);
  }
}
