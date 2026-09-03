import type { ApiErrorResponse } from '@finance/contracts';
import { getApiBaseUrl } from './config';
import { ApiError } from './errors';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type TokenGetter = () => string | null | undefined;
export type UnauthorizedCallback = () => void | Promise<void>;
export type RefreshHandler = () => Promise<string | null>;

let tokenGetter: TokenGetter = () => null;
let onUnauthorized: UnauthorizedCallback = () => {};
let refreshHandler: RefreshHandler | null = null;

/**
 * Wires the session into the API client. Called once from the client bootstrap;
 * kept as setters (rather than importing the store here) so this module stays
 * importable from tests and from server components without pulling React in.
 */
export function setTokenGetter(getter: TokenGetter) {
  tokenGetter = getter;
}

export function setUnauthorizedCallback(callback: UnauthorizedCallback) {
  onUnauthorized = callback;
}

export function setRefreshHandler(handler: RefreshHandler | null) {
  refreshHandler = handler;
}

export type QueryValue = string | number | boolean | null | undefined | (string | number)[];

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Attach the bearer token. Defaults to true — almost everything is private. */
  auth?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Internal: prevents an infinite refresh loop. */
  _retried?: boolean;
  /**
   * Suppresses the global 401 handler. Login must set this, otherwise a wrong
   * password triggers a session wipe and a redirect that destroys the very
   * error message the user needs to read.
   */
  skipAuthRedirect?: boolean;
}

function buildQueryString(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined;
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = `${getApiBaseUrl()}${path}${buildQueryString(opts.query)}`;
  const useAuth = opts.auth ?? true;

  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  const hasBody = opts.body !== undefined;
  if (hasBody) headers['Content-Type'] = 'application/json';
  if (useAuth) {
    const token = tokenGetter();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      // The refresh cookie is HttpOnly and lives on the API origin.
      credentials: 'include',
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError({
      statusCode: 0,
      code: 'network_error',
      message: 'Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.',
      path,
      cause,
    });
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    const data = await parseJsonSafe(res);
    if (data === undefined) return (await res.text()) as unknown as T;
    return data as T;
  }

  // A 401 on a normal call means the short access token expired: try one silent
  // refresh, then replay. Only when that fails do we tear the session down.
  if (res.status === 401 && useAuth && !opts._retried && !opts.skipAuthRedirect && refreshHandler) {
    const refreshed = await refreshHandler();
    if (refreshed) {
      return request<T>(path, { ...opts, _retried: true });
    }
  }

  const errBody = (await parseJsonSafe(res)) as ApiErrorResponse | undefined;

  if (res.status === 401 && !opts.skipAuthRedirect) {
    await onUnauthorized();
  }

  throw new ApiError({
    statusCode: errBody?.statusCode ?? res.status,
    code: errBody?.error ?? 'http_error',
    message: errBody?.message || fallbackMessage(res.status),
    details: errBody?.details,
    path: errBody?.path ?? path,
    requestId: errBody?.requestId,
  });
}

function fallbackMessage(status: number): string {
  if (status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (status === 403) return 'Você não tem acesso a este recurso.';
  if (status === 404) return 'Recurso não encontrado.';
  if (status === 409) return 'Este registro conflita com um já existente.';
  if (status === 413) return 'Arquivo maior que o permitido.';
  if (status === 429) return 'Muitas tentativas. Aguarde um instante.';
  if (status >= 500) return 'O servidor teve um problema. Tente novamente em instantes.';
  return 'Não foi possível completar a operação.';
}

/** Multipart upload (import preview). Never sets Content-Type by hand. */
export async function upload<T>(
  path: string,
  formData: FormData,
  opts: Omit<RequestOptions, 'body' | 'method'> = {},
): Promise<T> {
  const url = `${getApiBaseUrl()}${path}${buildQueryString(opts.query)}`;
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  const token = tokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
    signal: opts.signal,
    credentials: 'include',
  });

  if (res.ok) return (await parseJsonSafe(res)) as T;

  const errBody = (await parseJsonSafe(res)) as ApiErrorResponse | undefined;
  if (res.status === 401) await onUnauthorized();
  throw new ApiError({
    statusCode: errBody?.statusCode ?? res.status,
    code: errBody?.error ?? 'http_error',
    message: errBody?.message || fallbackMessage(res.status),
    details: errBody?.details,
    path,
    requestId: errBody?.requestId,
  });
}
