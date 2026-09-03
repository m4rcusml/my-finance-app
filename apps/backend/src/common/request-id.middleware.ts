import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export interface RequestWithId extends Request {
  requestId: string;
}

/**
 * Stamps every request with a correlation id, echoed back in `X-Request-Id` and
 * embedded in error bodies, so a user-visible failure can be traced to the exact
 * server log line without the response ever carrying internal detail.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
    (req as RequestWithId).requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
  }
}
