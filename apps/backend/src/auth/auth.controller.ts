import type { AuthSessionResponse, CsrfTokenResponse, UserProfile } from '@finance/contracts';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { EnvConfig } from '../config/env';
import { Public } from '../decorators/public.decorator';
import { CurrentUser, type UserPayload } from '../decorators/user.decorator';
import { UserProfileDto } from '../users/users.dto';
import { UsersService } from '../users/users.service';
import { AuthSessionResponseDto, CsrfTokenResponseDto, LoginDto, RegisterDto } from './auth.dto';
import type { IssuedSession } from './auth.service';
import { AuthService } from './auth.service';
import { AUTH_RATE_LIMIT } from './constants';
import {
  assertDoubleSubmitCsrf,
  clearSessionCookies,
  generateCsrfToken,
  readRefreshCookie,
  setCsrfCookie,
  setSessionCookies,
} from './cookies';

/**
 * Session endpoints. The full design (why the refresh token is opaque, why it
 * rotates, why only this controller needs a CSRF token) is documented at the
 * top of `constants.ts`.
 *
 * `register`, `login` and `refresh` are limited to 10 attempts per minute per
 * IP on top of the global 300/min floor, which is what makes credential
 * stuffing and refresh-cookie brute forcing impractical.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  @Public()
  @Throttle({ global: { limit: AUTH_RATE_LIMIT.limit, ttl: AUTH_RATE_LIMIT.ttl } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cria uma conta e já abre a sessão.',
    description: [
      'O e-mail é normalizado (sem espaços, em minúsculas). A senha precisa ter',
      'no mínimo 10 caracteres e não estar na lista de senhas óbvias.',
      '',
      'Devolve o `accessToken` no corpo e define os cookies `refresh_token`',
      '(HttpOnly) e `csrf_token`. Limite: 10 tentativas por minuto por IP.',
    ].join(' '),
  })
  @ApiCreatedResponse({ type: AuthSessionResponseDto })
  @ApiConflictResponse({ description: 'Este e-mail já está em uso.' })
  @ApiTooManyRequestsResponse({ description: 'Muitas tentativas. Tente novamente em instantes.' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response): Promise<AuthSessionResponse> {
    return this.respondWithSession(res, await this.auth.register(dto));
  }

  @Public()
  @Throttle({ global: { limit: AUTH_RATE_LIMIT.limit, ttl: AUTH_RATE_LIMIT.ttl } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autentica e abre a sessão.',
    description: [
      'E-mail desconhecido e senha errada devolvem exatamente o mesmo 401, com',
      'o mesmo tempo de resposta, para que a rota não sirva de oráculo de',
      'existência de contas. Limite: 10 tentativas por minuto por IP.',
    ].join(' '),
  })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiUnauthorizedResponse({ description: 'E-mail ou senha inválidos.' })
  @ApiTooManyRequestsResponse({ description: 'Muitas tentativas. Tente novamente em instantes.' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<AuthSessionResponse> {
    return this.respondWithSession(res, await this.auth.login(dto));
  }

  @Public()
  @Get('csrf')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Prepara a proteção CSRF para renovar a sessão.',
    description: [
      'Define um cookie HttpOnly no domínio da API e devolve o valor pareado no',
      'corpo. Envie esse valor em `X-CSRF-Token` no próximo POST /auth/refresh.',
      'A resposta permite usar frontend e API em hosts diferentes sem ler',
      '`document.cookie`.',
    ].join(' '),
  })
  @ApiOkResponse({ type: CsrfTokenResponseDto })
  csrf(@Res({ passthrough: true }) res: Response): CsrfTokenResponse {
    const csrfToken = generateCsrfToken();
    // This body is a per-browser secret paired with the cookie below. A shared
    // cache must never replay it alongside a different client's Set-Cookie.
    res.setHeader('Cache-Control', 'no-store');
    setCsrfCookie(res, this.config, csrfToken);
    return { csrfToken };
  }

  @Public()
  @Throttle({ global: { limit: AUTH_RATE_LIMIT.limit, ttl: AUTH_RATE_LIMIT.ttl } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('refresh-cookie')
  @ApiHeader({
    name: 'X-CSRF-Token',
    required: true,
    description: 'Deve repetir o valor do cookie `csrf_token` (double submit).',
  })
  @ApiOperation({
    summary: 'Rotaciona a sessão a partir do cookie `refresh_token`.',
    description: [
      'Única rota autenticada por cookie, e por isso a única que exige o token',
      'CSRF. O refresh apresentado vira um tombstone ligado a um único sucessor.',
      'Replay conhecido revoga somente aquela família de sessão.',
    ].join(' '),
  })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiForbiddenResponse({ description: 'Token CSRF ausente ou inválido.' })
  @ApiUnauthorizedResponse({ description: 'Sessão inválida ou expirada.' })
  @ApiTooManyRequestsResponse({ description: 'Muitas tentativas. Tente novamente em instantes.' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthSessionResponse> {
    assertDoubleSubmitCsrf(req);
    try {
      return this.respondWithSession(res, await this.auth.refresh(readRefreshCookie(req)));
    } catch (error) {
      // A 409 is the expected loser of a concurrent refresh. It must not emit
      // Set-Cookie tombstones that could overwrite the winning response.
      // Likewise, infrastructure failures keep the cookie retryable. Only a
      // terminal 401 proves this browser's cookie is unusable.
      if (error instanceof UnauthorizedException) clearSessionCookies(res, this.config);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('refresh-cookie')
  @ApiOperation({
    summary: 'Encerra a sessão atual.',
    description: [
      'Revoga o refresh apresentado (apenas do próprio usuário) e limpa',
      'os dois cookies. Idempotente: chamar sem cookie, ou duas vezes, também',
      'devolve 204. As demais sessões do usuário continuam válidas.',
    ].join(' '),
  })
  @ApiNoContentResponse({ description: 'Sessão encerrada.' })
  @ApiUnauthorizedResponse({ description: 'Sessão inválida ou expirada.' })
  async logout(
    @CurrentUser() user: UserPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(user.sub, readRefreshCookie(req));
    clearSessionCookies(res, this.config);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Perfil do usuário autenticado.' })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiUnauthorizedResponse({ description: 'Sessão inválida ou expirada.' })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado.' })
  me(@CurrentUser() user: UserPayload): Promise<UserProfile> {
    return this.users.findProfile(user.sub);
  }

  /** Cookies out, body back. The refresh token never appears in the JSON. */
  private respondWithSession(res: Response, issued: IssuedSession): AuthSessionResponse {
    setSessionCookies(res, this.config, issued);
    return issued.session;
  }
}
