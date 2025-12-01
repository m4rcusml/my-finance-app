import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface UserPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export interface RequestWithUser extends Request {
  user: UserPayload;
}

export const CurrentUser = createParamDecorator((_data: UserPayload, ctx: ExecutionContext): UserPayload => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  return request.user;
});
