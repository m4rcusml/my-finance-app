import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';
import type { RequestWithId } from './request-id.middleware';

/** Fields that must never reach a log line. */
const REDACTED = new Set(['password', 'currentPassword', 'newPassword', 'passwordHash', 'accessToken', 'refreshToken', 'token']);

/**
 * One structured line per request: method, route, status, duration, requestId
 * and user id. Bodies are never logged — financial amounts, descriptions and
 * credentials all live there.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Http');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & Partial<RequestWithId> & { user?: { sub?: string } }>();
    const res = http.getResponse<Response>();
    const startedAt = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.write(req, res.statusCode, startedAt),
        error: (err) => this.write(req, (err?.status as number) ?? 500, startedAt),
      }),
    );
  }

  private write(
    req: Request & Partial<RequestWithId> & { user?: { sub?: string } },
    statusCode: number,
    startedAt: bigint,
  ) {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    this.logger.log({
      requestId: req.requestId ?? 'unknown',
      method: req.method,
      path: req.route?.path ?? req.url.split('?')[0],
      statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userId: req.user?.sub ?? null,
    });
  }
}

/** Exported for tests and for anywhere that needs to scrub an object before logging. */
export function redact<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redact) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACTED.has(k) ? '[redacted]' : redact(v);
    }
    return out as T;
  }
  return value;
}
