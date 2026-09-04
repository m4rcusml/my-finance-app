import type { UserProfile } from '@finance/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usersApi } from '@/shared/lib/api';
import { SettingsClient } from './settings-client';

const mockLogout = jest.fn();

const profile: UserProfile = {
  id: 'user-a',
  email: 'ana@example.com',
  name: 'Ana',
  createdAt: '2026-09-03T12:00:00.000Z',
  updatedAt: '2026-09-03T12:00:00.000Z',
};

jest.mock('@/shared/lib/api', () => {
  const actual = jest.requireActual('@/shared/lib/api');
  return {
    ...actual,
    usersApi: {
      ...actual.usersApi,
      update: jest.fn(),
      changePassword: jest.fn(),
      remove: jest.fn(),
    },
  };
});

jest.mock('@/shared/session/session-provider', () => ({
  useSession: () => ({ user: profile, sessionKey: profile.id, logout: mockLogout }),
}));

jest.mock('@/shared/ui/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn() }),
}));

const mockedUsersApi = jest.mocked(usersApi);

describe('SettingsClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUsersApi.changePassword.mockResolvedValue(undefined);
  });

  it('rejeita uma nova senha comum sem chamar a API', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SettingsClient view="security" />
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText(/^Senha atual/), 'Senha-Atual!2026');
    await user.type(screen.getByLabelText(/^Nova senha/), 'senha@1234');
    await user.type(screen.getByLabelText(/^Confirmar nova senha/), 'senha@1234');
    await user.click(screen.getByRole('button', { name: 'Alterar senha e sair' }));

    expect(screen.getByText('Esta senha é muito comum. Escolha uma senha menos previsível.')).toBeInTheDocument();
    expect(mockedUsersApi.changePassword).not.toHaveBeenCalled();
  });

  it('não trunca uma nova senha acima do limite', () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SettingsClient view="security" />
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText(/^Senha atual/)).not.toHaveAttribute('maxlength');
    expect(screen.getByLabelText(/^Nova senha/)).not.toHaveAttribute('maxlength');
    expect(screen.getByLabelText(/^Confirmar nova senha/)).not.toHaveAttribute('maxlength');
  });
});
