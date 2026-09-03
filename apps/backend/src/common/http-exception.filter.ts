import { type ApiErrorCode, type ApiErrorResponse } from '@finance/contracts';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { RequestWithId } from './request-id.middleware';

const STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  [HttpStatus.BAD_REQUEST]: 'bad_request',
  [HttpStatus.UNAUTHORIZED]: 'unauthorized',
  [HttpStatus.FORBIDDEN]: 'forbidden',
  [HttpStatus.NOT_FOUND]: 'not_found',
  [HttpStatus.CONFLICT]: 'conflict',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'payload_too_large',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'unsupported_media_type',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'unprocessable_entity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'too_many_requests',
};

const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  bad_request: 'Requisição inválida.',
  validation_failed: 'Alguns campos estão inválidos.',
  unauthorized: 'Sessão inválida ou expirada.',
  forbidden: 'Você não tem acesso a este recurso.',
  not_found: 'Recurso não encontrado.',
  conflict: 'Este registro conflita com um já existente.',
  payload_too_large: 'Arquivo ou payload maior que o permitido.',
  unsupported_media_type: 'Formato de arquivo não suportado.',
  unprocessable_entity: 'Não foi possível processar a requisição.',
  too_many_requests: 'Muitas tentativas. Tente novamente em instantes.',
  internal_error: 'Ocorreu um erro inesperado. Tente novamente.',
};

/**
 * Turns every thrown value into the single `ApiErrorResponse` shape.
 *
 * Two rules that the previous filter broke:
 *  1. a 5xx body never contains `exception.message` — the raw text (which for
 *     Prisma includes the rendered query arguments) goes to the server log,
 *     keyed by `requestId`, and the client gets a generic sentence;
 *  2. `error` reflects the actual status, so a 401 is `unauthorized` rather
 *     than being labelled `Internal Server Error`.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & Partial<RequestWithId>>();
    const requestId = request.requestId ?? 'unknown';

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ApiErrorCode = 'internal_error';
    let message = DEFAULT_MESSAGES.internal_error;
    let details: string[] | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      code = STATUS_TO_CODE[statusCode] ?? (statusCode >= 500 ? 'internal_error' : 'bad_request');
      message = DEFAULT_MESSAGES[code];

      const body = exception.getResponse();
      if (typeof body === 'string') {
        if (body && body !== exception.name) message = body;
      } else if (body && typeof body === 'object') {
        const record = body as { message?: unknown; error?: unknown };
        if (Array.isArray(record.message)) {
          // class-validator produces an array of constraint messages.
          code = 'validation_failed';
          message = DEFAULT_MESSAGES.validation_failed;
          details = record.message.map(String);
        } else if (typeof record.message === 'string' && record.message.length > 0) {
          message = record.message;
        }
      }
    } else {
      const knownCode = mapKnownDatabaseError(exception);
      if (knownCode) {
        statusCode = knownCode.status;
        code = knownCode.code;
        message = knownCode.message;
      }
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Full detail stays server-side, correlated by requestId.
      this.logger.error(
        {
          requestId,
          method: request.method,
          path: request.url,
          statusCode,
          error: exception instanceof Error ? exception.message : String(exception),
        },
        exception instanceof Error ? exception.stack : undefined,
      );
      message = DEFAULT_MESSAGES.internal_error;
      details = undefined;
    }

    const body: ApiErrorResponse = {
      statusCode,
      error: code,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    };

    response.status(statusCode).json(body);
  }
}

/**
 * Maps the database errors we deliberately surface. Anything else falls through
 * to a generic 500 — we never echo driver text to the client.
 */
function mapKnownDatabaseError(exception: unknown): { status: number; code: ApiErrorCode; message: string } | null {
  const code = (exception as { code?: string } | null)?.code;

  // Prisma known-request-error codes.
  if (code === 'P2002') {
    return { status: HttpStatus.CONFLICT, code: 'conflict', message: 'Já existe um registro com esses dados.' };
  }
  if (code === 'P2025') {
    return { status: HttpStatus.NOT_FOUND, code: 'not_found', message: DEFAULT_MESSAGES.not_found };
  }
  if (code === 'P2003') {
    return {
      status: HttpStatus.CONFLICT,
      code: 'conflict',
      message: 'Este registro está vinculado a outros e não pode ser removido.',
    };
  }
  if (code === 'P2000') {
    return { status: HttpStatus.BAD_REQUEST, code: 'bad_request', message: 'Um dos valores enviados é longo demais.' };
  }

  // Raw PostgreSQL SQLSTATEs (reachable through $queryRaw / adapter errors).
  if (code === '23505') {
    return { status: HttpStatus.CONFLICT, code: 'conflict', message: 'Já existe um registro com esses dados.' };
  }
  if (code === '23503') {
    return {
      status: HttpStatus.CONFLICT,
      code: 'conflict',
      message: 'Este registro está vinculado a outros e não pode ser removido.',
    };
  }
  if (code === '23514') {
    return {
      status: HttpStatus.BAD_REQUEST,
      code: 'bad_request',
      message: 'Os dados enviados violam uma regra de integridade do sistema.',
    };
  }

  return null;
}
