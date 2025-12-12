import { getApiBaseUrl } from './config';
import { ApiError, type ApiErrorBody } from './errors';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type TokenGetter = () => string | null | undefined;

let tokenGetter: TokenGetter | null = null;

/**
 * Call this once at app startup (client-side) to wire auth store into the API client.
 */
export function setTokenGetter(getter: TokenGetter) {
  tokenGetter = getter;
}

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  auth?: boolean; // if true, attach Bearer token
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

function buildQueryString(
  query?: Record<string, string | number | boolean | null | undefined>
): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    if (v === null) continue; // omit null by default
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation> Expected
async function parseJsonSafe(res: Response): Promise<any | undefined> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return undefined;
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

export async function request<T>(
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}${buildQueryString(opts.query)}`;

  const headers: Record<string, string> = {
    ...(opts.headers ?? {}),
  };

  // Only set JSON header if we actually have a body
  const hasBody = opts.body !== undefined;
  if (hasBody) headers['Content-Type'] = 'application/json';

  if (opts.auth) {
    const token = tokenGetter?.() ?? null;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: hasBody ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  if (res.ok) {
    // 204 No Content
    if (res.status === 204) return undefined as T;

    const data = await parseJsonSafe(res);
    // If not JSON, try text (rare)
    if (data === undefined) {
      const text = await res.text();
      return text as unknown as T;
    }
    return data as T;
  }

  const errBody = (await parseJsonSafe(res)) as ApiErrorBody;

  // Fallback message if backend didn't send JSON
  const message =
    errBody?.message ||
    `Request failed with status ${res.status} ${res.statusText}`;

  throw new ApiError({
    statusCode: errBody?.statusCode ?? res.status,
    code: errBody?.error ?? 'HTTP_ERROR',
    message,
    details: errBody?.details,
    path: errBody?.path ?? path,
  });
}
