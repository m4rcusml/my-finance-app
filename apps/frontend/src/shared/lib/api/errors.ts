import type { ApiErrorCode } from '@finance/contracts';

export class ApiError extends Error {
  readonly statusCode: number;
  /** Backend `error` code, or `network_error` / `http_error` when we synthesised it. */
  readonly code: ApiErrorCode | 'network_error' | 'http_error';
  readonly details?: string[];
  readonly path?: string;
  /** Correlates with the server log; safe to show in a "detalhes técnicos" box. */
  readonly requestId?: string;

  constructor(params: {
    statusCode: number;
    code: ApiErrorCode | 'network_error' | 'http_error';
    message: string;
    details?: string[];
    path?: string;
    requestId?: string;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = 'ApiError';
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details;
    this.path = params.path;
    this.requestId = params.requestId;
  }

  get isAuthError() {
    return this.statusCode === 401;
  }

  get isNotFound() {
    return this.statusCode === 404;
  }

  get isConflict() {
    return this.statusCode === 409;
  }
}

/** Message to render in an alert. Falls back to something useful for unknown throwables. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Ocorreu um erro inesperado. Tente novamente.';
}

/** Field-level messages, when the backend sent validation details. */
export function errorDetails(error: unknown): string[] {
  return error instanceof ApiError && error.details ? error.details : [];
}
