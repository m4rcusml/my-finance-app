import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * The claims carried by an **access token**.
 *
 * `tokenVersion` is the revocation lever: it is minted into the JWT and
 * re-checked on every request by `AuthGuard`. Bumping `users.token_version`
 * (password change, "sair de todos os dispositivos") makes every outstanding
 * access token fail verification without needing a token blacklist.
 */
export interface AccessTokenClaims {
  /** User id. */
  sub: string;
  email: string;
  /** Must match `users.token_version` or the token is dead. */
  tokenVersion: number;
  /** Issued-at, seconds since epoch (added by `@nestjs/jwt`). */
  iat: number;
  /** Expiry, seconds since epoch (added by `@nestjs/jwt`). */
  exp: number;
}

/** Historical alias — most controllers import this name. */
export type UserPayload = AccessTokenClaims;

export interface RequestWithUser extends Request {
  user: AccessTokenClaims;
}

/**
 * `@CurrentUser()` — the verified claims that `AuthGuard` attached to the
 * request. Never populated on a `@Public()` route, so a handler that reads it
 * must be behind the guard.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AccessTokenClaims => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  return request.user;
});
