import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { EnvConfig } from '../config/env';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AccessTokenClaims, RequestWithUser } from '../decorators/user.decorator';
import { UsersService } from '../users/users.service';
import { INVALID_SESSION_MESSAGE } from './constants';

/**
 * The global authentication guard.
 *
 * Two checks, in order:
 *  1. the JWT verifies against `JWT_SECRET` read from the typed ConfigService
 *     (never `process.env` directly, never an implicit default);
 *  2. the token's `tokenVersion` claim still matches `users.token_version`.
 *
 * Step 2 costs one primary-key lookup of a single column per request. A cached
 * version would be cheaper, but any cache TTL is a window in which a password
 * change does *not* actually revoke outstanding access tokens — and the whole
 * point of the claim is that it does. Correctness first; if this ever shows up
 * in a profile, the fix is a cache with explicit invalidation, not a TTL.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(request);
    if (!token) throw new UnauthorizedException(INVALID_SESSION_MESSAGE);

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: this.config.get('JWT_SECRET', { infer: true }),
      });
    } catch {
      // Expired, wrong signature, malformed — the client learns none of it.
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    if (typeof claims?.sub !== 'string' || typeof claims?.tokenVersion !== 'number') {
      // A token signed with our key but without the claims we mint today.
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const currentVersion = await this.users.findTokenVersion(claims.sub);
    if (currentVersion === null || currentVersion !== claims.tokenVersion) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    request.user = claims;
    return true;
  }
}

function extractBearerToken(request: Request): string | undefined {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  return scheme === 'Bearer' && token ? token : undefined;
}
