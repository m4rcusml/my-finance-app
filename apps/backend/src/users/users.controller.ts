import type { UserProfile } from '@finance/contracts';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { clearSessionCookies } from '../auth/cookies';
import type { EnvConfig } from '../config/env';
import { CurrentUser, type UserPayload } from '../decorators/user.decorator';
import { ChangePasswordDto, DeleteAccountDto, UpdateProfileDto, UserProfileDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Sessão inválida ou expirada.' })
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil do usuário autenticado.' })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado.' })
  findMe(@CurrentUser() user: UserPayload): Promise<UserProfile> {
    return this.users.findProfile(user.sub);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Atualiza nome e/ou e-mail.',
    description: [
      'Semântica PATCH: campo ausente não é tocado, `name: null` limpa o nome.',
      'Alterar o e-mail exige `currentPassword`, porque é o endereço para onde',
      'uma futura redefinição de senha seria enviada.',
    ].join(' '),
  })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiBadRequestResponse({ description: 'Senha atual não informada para troca de e-mail.' })
  @ApiConflictResponse({ description: 'Este e-mail já está em uso.' })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado.' })
  updateMe(@CurrentUser() user: UserPayload, @Body() dto: UpdateProfileDto): Promise<UserProfile> {
    return this.users.updateProfile(user.sub, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Troca a senha e encerra todas as sessões.',
    description: [
      'Verifica a senha atual, incrementa o `tokenVersion` (o que invalida todo',
      'access token já emitido) e apaga todos os refresh tokens do usuário.',
      'Os cookies desta requisição também são limpos: é preciso entrar de novo.',
    ].join(' '),
  })
  @ApiNoContentResponse({ description: 'Senha alterada; faça login novamente.' })
  @ApiBadRequestResponse({ description: 'A nova senha não atende à política.' })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado.' })
  async changePassword(
    @CurrentUser() user: UserPayload,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.users.changePassword(user.sub, dto);
    clearSessionCookies(res, this.config);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Exclui a conta e todos os dados. Irreversível.',
    description: [
      'Exige a senha e a confirmação exata `EXCLUIR MINHA CONTA`.',
      '',
      'A exclusão é em cascata (`ON DELETE CASCADE` em todas as chaves',
      'estrangeiras `user_id`) e remove: contas, cartões de crédito, categorias,',
      'transações, transações fixas e suas ocorrências, investimentos, ativos de',
      'mercado próprios, metas, arquivos importados, lotes de importação e todos',
      'os refresh tokens. Nada é arquivado e não há como desfazer.',
      '',
      'Responde 204 sem corpo — nunca devolve o usuário excluído.',
    ].join(' '),
  })
  @ApiNoContentResponse({ description: 'Conta excluída.' })
  @ApiBadRequestResponse({ description: 'Confirmação incorreta.' })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado.' })
  async deleteMe(
    @CurrentUser() user: UserPayload,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.users.deleteAccount(user.sub, dto);
    clearSessionCookies(res, this.config);
  }
}
