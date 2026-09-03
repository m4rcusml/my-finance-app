import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/pagination.dto';
import { CurrentUser, type UserPayload } from '../decorators/user.decorator';
import { ACCEPTED_IMPORT_EXTENSIONS } from './file-type';
import { ABSOLUTE_MAX_UPLOAD_BYTES, ImportFilePipe, type UploadedImportFile } from './import-file.pipe';
import {
  ConfirmImportDto,
  ConfirmImportResponseDto,
  ImportPreviewResponseDto,
  PaginatedImportedFilesDto,
  PreviewImportDto,
} from './imports.dto';
import { ImportsService } from './imports.service';

@ApiTags('imports')
@ApiBearerAuth('access-token')
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('preview')
  @ApiOperation({
    summary: 'Analisa um extrato ou fatura e guarda o resultado',
    description: [
      'Faz o parsing do arquivo no servidor e persiste um lote com uma linha por lançamento.',
      'O lote expira em IMPORT_BATCH_TTL_MINUTES minutos e é confirmado depois, por id.',
      `Formatos aceitos: ${ACCEPTED_IMPORT_EXTENSIONS.join(', ')}.`,
    ].join(' '),
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['file', 'origin'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Extrato ou fatura exportada pelo banco.' },
        origin: { type: 'string', enum: ['inter', 'generic'], description: 'Layout esperado do arquivo.' },
      },
    },
  })
  @ApiCreatedResponse({ type: ImportPreviewResponseDto })
  @ApiBadRequestResponse({ description: 'Arquivo vazio, ilegível ou acima do limite de linhas.' })
  @ApiPayloadTooLargeResponse({ description: 'Arquivo acima de MAX_UPLOAD_BYTES.' })
  @ApiUnsupportedMediaTypeResponse({ description: 'Extensão e conteúdo do arquivo não conferem.' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: ABSOLUTE_MAX_UPLOAD_BYTES, files: 1 } }))
  preview(
    @CurrentUser() user: UserPayload,
    @UploadedFile(ImportFilePipe) file: UploadedImportFile,
    @Body() dto: PreviewImportDto,
  ) {
    return this.importsService.preview(user.sub, file, dto);
  }

  @Post(':batchId/confirm')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Importa as linhas de um lote já analisado',
    description: [
      'As linhas vêm do lote guardado no servidor — o corpo da requisição escolhe apenas o destino',
      'e quais linhas importar. Tudo acontece em uma única transação e nada é gravado em duplicidade.',
    ].join(' '),
  })
  @ApiCreatedResponse({ type: ConfirmImportResponseDto })
  @ApiBadRequestResponse({ description: 'Lote expirado, destino inválido ou linhas inexistentes.' })
  @ApiNotFoundResponse({ description: 'Lote, conta ou cartão não encontrado.' })
  @ApiConflictResponse({ description: 'Lote já confirmado.' })
  confirm(
    @CurrentUser() user: UserPayload,
    @Param('batchId', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) batchId: string,
    @Body() dto: ConfirmImportDto,
  ) {
    return this.importsService.confirm(user.sub, batchId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Histórico de arquivos importados' })
  @ApiOkResponse({ type: PaginatedImportedFilesDto })
  findAll(@CurrentUser() user: UserPayload, @Query() pagination: PaginationQueryDto) {
    return this.importsService.listImportedFiles(user.sub, pagination);
  }

  @Get(':batchId')
  @ApiOperation({
    summary: 'Relê a prévia de um lote',
    description: 'Permite recarregar a tela sem reenviar o arquivo.',
  })
  @ApiOkResponse({ type: ImportPreviewResponseDto })
  @ApiNotFoundResponse({ description: 'Lote não encontrado.' })
  findBatch(
    @CurrentUser() user: UserPayload,
    @Param('batchId', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) batchId: string,
  ) {
    return this.importsService.findBatch(user.sub, batchId);
  }
}
