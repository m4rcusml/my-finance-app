import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message = 'An unexpected error occurred';
    let details: unknown | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        error = (resObj.error as string) || error;
        message = (resObj.message as string) || message;
        details = resObj.details ?? resObj.message;

        // For validation errors, message is usually an array
        if (Array.isArray(resObj.message)) {
          message = 'Validation failed';
          details = resObj.message;
        }
      }
    } else if (exception instanceof Error) {
      // Prisma and other non-HTTP errors
      message = exception.message;

      // Prisma unique constraint
      if (message.includes('Unique constraint failed')) {
        statusCode = HttpStatus.CONFLICT;
        error = 'Conflict';
        message = 'A record with this value already exists';
      }

      // Prisma record not found
      if (message.includes('Record to delete does not exist') || message.includes('Record to update does not exist')) {
        statusCode = HttpStatus.NOT_FOUND;
        error = 'Not Found';
        message = 'Record not found';
      }
    }

    const errorResponse: ErrorResponse = {
      statusCode,
      error,
      message,
      ...(details !== undefined && details !== message ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(errorResponse);
  }
}
