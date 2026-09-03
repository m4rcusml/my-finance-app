import { ApiError } from './errors';
import { request, setRefreshHandler, setTokenGetter, setUnauthorizedCallback, upload } from './http';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('cliente HTTP autenticado', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    setTokenGetter(() => null);
    setRefreshHandler(null);
    setUnauthorizedCallback(() => {});
    jest.restoreAllMocks();
  });

  it('renova e repete uma chamada mesmo quando o redirecionamento de 401 está suprimido', async () => {
    let accessToken = 'access-antigo';
    const refresh = jest.fn(async () => {
      accessToken = 'access-novo';
      return accessToken;
    });
    const unauthorized = jest.fn();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { statusCode: 401, error: 'unauthorized', message: 'expirou' }))
      .mockResolvedValueOnce(jsonResponse(204, undefined));
    global.fetch = fetchMock;
    setTokenGetter(() => accessToken);
    setRefreshHandler(refresh);
    setUnauthorizedCallback(unauthorized);

    await expect(request<void>('/auth/logout', { method: 'POST', skipAuthRedirect: true })).resolves.toBeUndefined();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer access-antigo' });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer access-novo' });
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('aplica a mesma recuperação única a uploads multipart', async () => {
    let accessToken = 'access-antigo';
    const refresh = jest.fn(async () => {
      accessToken = 'access-novo';
      return accessToken;
    });
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { statusCode: 401, error: 'unauthorized', message: 'expirou' }))
      .mockResolvedValueOnce(jsonResponse(201, { batchId: 'batch-1' }));
    global.fetch = fetchMock;
    setTokenGetter(() => accessToken);
    setRefreshHandler(refresh);
    const body = new FormData();
    body.append('origin', 'inter');

    await expect(upload<{ batchId: string }>('/imports/preview', body)).resolves.toEqual({
      batchId: 'batch-1',
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(body);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(body);
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer access-novo' });
  });

  it('normaliza o erro terminal de upload e aciona a limpeza da sessão', async () => {
    const unauthorized = jest.fn();
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(401, {
        statusCode: 401,
        error: 'unauthorized',
        message: 'Sessão inválida.',
        requestId: 'request-123',
      }),
    );
    setTokenGetter(() => 'access-antigo');
    setRefreshHandler(async () => null);
    setUnauthorizedCallback(unauthorized);

    const promise = upload('/imports/preview', new FormData());
    await expect(promise).rejects.toMatchObject({
      statusCode: 401,
      message: 'Sessão inválida.',
      requestId: 'request-123',
    } satisfies Partial<ApiError>);
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });
});
