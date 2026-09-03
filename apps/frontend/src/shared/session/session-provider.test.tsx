import type { AuthSessionResponse } from '@finance/contracts';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { ApiError, authApi, setRefreshHandler, setTokenGetter, setUnauthorizedCallback } from '@/shared/lib/api';
import { ANONYMOUS_SESSION_KEY, useAuthStore } from '@/shared/stores/auth-store';
import { SessionProvider, useSession } from './session-provider';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/shared/lib/api', () => {
  const actual = jest.requireActual('@/shared/lib/api');
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      csrf: jest.fn(),
      refresh: jest.fn(),
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    },
    setRefreshHandler: jest.fn(),
    setTokenGetter: jest.fn(),
    setUnauthorizedCallback: jest.fn(),
  };
});

const firstSession: AuthSessionResponse = {
  accessToken: 'access-token-a',
  expiresIn: 900,
  user: {
    id: 'user-a',
    email: 'ana@example.com',
    name: 'Ana',
    createdAt: '2026-09-03T12:00:00.000Z',
    updatedAt: '2026-09-03T12:00:00.000Z',
  },
};

const secondSession: AuthSessionResponse = {
  accessToken: 'access-token-b',
  expiresIn: 900,
  user: {
    id: 'user-b',
    email: 'bia@example.com',
    name: 'Bia',
    createdAt: '2026-09-03T12:00:00.000Z',
    updatedAt: '2026-09-03T12:00:00.000Z',
  },
};

const mockedAuthApi = jest.mocked(authApi);
const mockedSetRefreshHandler = jest.mocked(setRefreshHandler);
const mockedSetTokenGetter = jest.mocked(setTokenGetter);
const mockedSetUnauthorizedCallback = jest.mocked(setUnauthorizedCallback);

function latestArgument<T>(mock: jest.Mock, index = 0): T {
  const call = mock.mock.calls[mock.mock.calls.length - 1];
  if (!call) throw new Error('A função esperada ainda não foi chamada.');
  return call[index] as T;
}

function SessionProbe({ onClient }: { onClient: (client: QueryClient) => void }) {
  const session = useSession();
  const queryClient = useQueryClient();

  useEffect(() => onClient(queryClient), [onClient, queryClient]);

  return (
    <>
      <output data-testid="session-status">{session.status}</output>
      <p>{session.user?.email ?? 'sem usuário'}</p>
      <button type="button" onClick={() => void session.login('bia@example.com', 'senha-segura')}>
        Entrar como Bia
      </button>
    </>
  );
}

describe('SessionProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({
      status: 'unknown',
      accessToken: null,
      user: null,
      sessionKey: ANONYMOUS_SESSION_KEY,
    });
    mockedAuthApi.csrf.mockResolvedValue({ csrfToken: 'csrf-a' });
    mockedAuthApi.refresh.mockResolvedValue(firstSession);
    mockedAuthApi.login.mockResolvedValue(secondSession);
    mockedAuthApi.logout.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({
      status: 'unknown',
      accessToken: null,
      user: null,
      sessionKey: ANONYMOUS_SESSION_KEY,
    });
  });

  it('restaura a sessão uma vez e mantém o token somente em memória', async () => {
    const onClient = jest.fn();
    render(
      <SessionProvider>
        <SessionProbe onClient={onClient} />
      </SessionProvider>,
    );

    expect(screen.getByTestId('session-status')).toHaveTextContent('unknown');
    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
    expect(mockedAuthApi.csrf).toHaveBeenCalledTimes(1);
    expect(mockedAuthApi.refresh).toHaveBeenCalledWith('csrf-a');

    const tokenGetter = latestArgument<() => string | null | undefined>(mockedSetTokenGetter);
    expect(tokenGetter()).toBe('access-token-a');
    expect(localStorage.getItem('finance-auth')).toBeNull();
  });

  it('troca o QueryClient e apaga o cache privado ao entrar como outra pessoa', async () => {
    const user = userEvent.setup();
    const onClient = jest.fn();
    render(
      <SessionProvider>
        <SessionProbe onClient={onClient} />
      </SessionProvider>,
    );

    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
    const firstClient = latestArgument<QueryClient>(onClient);
    const privateKey = ['session', 'user-a', 'accounts'] as const;
    firstClient.setQueryData(privateKey, ['Saldo privado de Ana']);
    expect(firstClient.getQueryData(privateKey)).toEqual(['Saldo privado de Ana']);

    // A nova autenticação também atualizaria o cookie de refresh no servidor.
    mockedAuthApi.refresh.mockResolvedValue(secondSession);
    await user.click(screen.getByRole('button', { name: 'Entrar como Bia' }));

    expect(await screen.findByText('bia@example.com')).toBeInTheDocument();
    await waitFor(() => expect(latestArgument<QueryClient>(onClient)).not.toBe(firstClient));

    const secondClient = latestArgument<QueryClient>(onClient);
    expect(firstClient.getQueryCache().getAll()).toHaveLength(0);
    expect(secondClient.getQueryData(privateKey)).toBeUndefined();
    expect(useAuthStore.getState().sessionKey).toBe('user-b');
  });

  it('apaga o cache e redireciona quando uma resposta 401 encerra a sessão', async () => {
    const onClient = jest.fn();
    render(
      <SessionProvider>
        <SessionProbe onClient={onClient} />
      </SessionProvider>,
    );

    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
    const firstClient = latestArgument<QueryClient>(onClient);
    const privateKey = ['session', 'user-a', 'transactions'] as const;
    firstClient.setQueryData(privateKey, ['Transação privada de Ana']);

    mockedAuthApi.refresh.mockRejectedValue(
      new ApiError({ statusCode: 401, code: 'unauthorized', message: 'Sessão expirada.' }),
    );
    const onUnauthorized = latestArgument<() => void | Promise<void>>(mockedSetUnauthorizedCallback);

    await act(async () => {
      await onUnauthorized();
    });

    await waitFor(() => expect(screen.getByTestId('session-status')).toHaveTextContent('anonymous'));
    await waitFor(() => expect(latestArgument<QueryClient>(onClient)).not.toBe(firstClient));
    expect(firstClient.getQueryCache().getAll()).toHaveLength(0);
    expect(latestArgument<QueryClient>(onClient).getQueryData(privateKey)).toBeUndefined();
    expect(useAuthStore.getState().sessionKey).toBe(ANONYMOUS_SESSION_KEY);
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('registra um único refresh handler reutilizável pela camada HTTP', async () => {
    const onClient = jest.fn();
    render(
      <SessionProvider>
        <SessionProbe onClient={onClient} />
      </SessionProvider>,
    );

    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
    const refresh = latestArgument<() => Promise<string | null>>(mockedSetRefreshHandler);

    await expect(refresh()).resolves.toBe('access-token-a');
    expect(useAuthStore.getState().accessToken).toBe('access-token-a');
  });
});
