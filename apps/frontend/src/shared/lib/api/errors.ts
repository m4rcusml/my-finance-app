export type ApiErrorBody =
  | {
    statusCode: number;
    error: string;
    message: string;
    details?: unknown;
    timestamp?: string;
    path?: string;
  }
  | undefined;

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly path?: string;

  constructor(params: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
    path?: string;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details;
    this.path = params.path;
  }
}
