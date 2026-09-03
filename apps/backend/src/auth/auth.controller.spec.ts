import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { EnvConfig } from '../config/env';
import type { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import type { AuthService, IssuedSession } from './auth.service';
import { CSRF_COOKIE_NAME, REFRESH_COOKIE_NAME } from './constants';

const CONFIG: Partial<EnvConfig> = {
  COOKIE_DOMAIN: '',
  COOKIE_SAMESITE: 'lax',
  COOKIE_SECURE: false,
  REFRESH_TOKEN_TTL_SECONDS: 2_592_000,
};

function responseMock(): jest.Mocked<Pick<Response, 'cookie' | 'clearCookie' | 'setHeader'>> {
  return { cookie: jest.fn(), clearCookie: jest.fn(), setHeader: jest.fn() };
}

function requestMock(refreshToken: string, csrfToken: string): Request {
  return {
    cookies: { [REFRESH_COOKIE_NAME]: refreshToken, [CSRF_COOKIE_NAME]: csrfToken },
    header: jest.fn().mockReturnValue(csrfToken),
  } as unknown as Request;
}

describe('AuthController session cookies', () => {
  let auth: jest.Mocked<Pick<AuthService, 'refresh'>>;
  let controller: AuthController;

  beforeEach(() => {
    auth = { refresh: jest.fn() };
    const config = { get: (key: keyof EnvConfig) => CONFIG[key] } as ConfigService<EnvConfig, true>;
    controller = new AuthController(auth as unknown as AuthService, {} as UsersService, config);
  });

  it('returns the CSRF value while setting the matching HttpOnly API cookie', () => {
    const response = responseMock();

    const result = controller.csrf(response as unknown as Response);

    expect(result.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(response.cookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      result.csrfToken,
      expect.objectContaining({ httpOnly: true, path: '/', maxAge: 2_592_000_000 }),
    );
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('does not clear a winning cookie when this request loses the refresh race', async () => {
    const response = responseMock();
    auth.refresh.mockRejectedValue(new ConflictException());

    await expect(
      controller.refresh(requestMock('a'.repeat(43), 'csrf'), response as unknown as Response),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(response.clearCookie).not.toHaveBeenCalled();
  });

  it('clears both cookies after a terminal unauthorized refresh', async () => {
    const response = responseMock();
    auth.refresh.mockRejectedValue(new UnauthorizedException());

    await expect(
      controller.refresh(requestMock('a'.repeat(43), 'csrf'), response as unknown as Response),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(response.clearCookie).toHaveBeenCalledTimes(2);
    expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, expect.any(Object));
    expect(response.clearCookie).toHaveBeenCalledWith(CSRF_COOKIE_NAME, expect.any(Object));
  });

  it('rotates both cookies and returns only the public session on success', async () => {
    const response = responseMock();
    const issued: IssuedSession = {
      session: {
        accessToken: 'access',
        expiresIn: 900,
        user: {
          id: 'user-1',
          email: 'user@example.com',
          name: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      refreshToken: 'b'.repeat(43),
      csrfToken: 'next-csrf',
    };
    auth.refresh.mockResolvedValue(issued);

    const result = await controller.refresh(requestMock('a'.repeat(43), 'csrf'), response as unknown as Response);

    expect(result).toEqual(issued.session);
    expect(JSON.stringify(result)).not.toContain(issued.refreshToken);
    expect(response.cookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, issued.refreshToken, expect.any(Object));
    expect(response.cookie).toHaveBeenCalledWith(CSRF_COOKIE_NAME, issued.csrfToken, expect.any(Object));
  });
});
