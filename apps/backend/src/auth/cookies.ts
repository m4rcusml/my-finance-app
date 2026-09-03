import { createHash, timingSafeEqual } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { EnvConfig } from '../config/env';
import {
  AUTH_COOKIE_PATH,
  CSRF_COOKIE_NAME,
  CSRF_COOKIE_PATH,
  CSRF_HEADER_NAME,
  REFRESH_COOKIE_NAME,
} from './constants';

export type TypedConfig = ConfigService<EnvConfig, true>;

/** Flags shared by both session cookies; every one of them comes from config. */
function baseCookieOptions(config: TypedConfig): CookieOptions {
  const domain = config.get('COOKIE_DOMAIN', { infer: true });
  return {
    secure: config.get('COOKIE_SECURE', { infer: true }),
    sameSite: config.get('COOKIE_SAMESITE', { infer: true }),
    // An empty string would be sent as `Domain=`, which browsers reject; an
    // absent domain produces the safer host-only cookie.
    domain: domain ? domain : undefined,
  };
}

export function refreshCookieOptions(config: TypedConfig): CookieOptions {
  return { ...baseCookieOptions(config), httpOnly: true, path: AUTH_COOKIE_PATH };
}

export function csrfCookieOptions(config: TypedConfig): CookieOptions {
  // Not HttpOnly by design: the SPA has to read it to echo it in the header.
  // That is safe — knowing the value is useless without a same-origin context.
  return { ...baseCookieOptions(config), httpOnly: false, path: CSRF_COOKIE_PATH };
}

/**
 * Writes both session cookies. Called on register, login and every refresh, so
 * the CSRF token rotates in lockstep with the refresh token.
 */
export function setSessionCookies(
  res: Response,
  config: TypedConfig,
  session: { refreshToken: string; csrfToken: string },
): void {
  const maxAge = config.get('REFRESH_TOKEN_TTL_SECONDS', { infer: true }) * 1000;
  res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, { ...refreshCookieOptions(config), maxAge });
  res.cookie(CSRF_COOKIE_NAME, session.csrfToken, { ...csrfCookieOptions(config), maxAge });
}

/**
 * Removes both cookies. The attributes must match the ones they were set with
 * (path and domain in particular) or the browser keeps the originals.
 */
export function clearSessionCookies(res: Response, config: TypedConfig): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions(config));
  res.clearCookie(CSRF_COOKIE_NAME, csrfCookieOptions(config));
}

export function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const value = cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Double-submit CSRF check for the one cookie-authenticated endpoint.
 *
 * A cross-site request can make the browser attach the `csrf_token` cookie, but
 * it cannot *read* it, so it cannot also set a matching `X-CSRF-Token` header.
 * Compared in constant time over SHA-256 digests, which keeps both the value
 * and its length out of the timing signal.
 */
export function assertDoubleSubmitCsrf(req: Request): void {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const cookieToken = cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.header(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken || !constantTimeEquals(cookieToken, headerToken)) {
    throw new ForbiddenException('Token CSRF ausente ou inválido.');
  }
}

function constantTimeEquals(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a).digest();
  const digestB = createHash('sha256').update(b).digest();
  return timingSafeEqual(digestA, digestB);
}
