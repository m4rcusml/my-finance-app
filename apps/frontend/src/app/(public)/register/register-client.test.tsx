import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/shared/lib/api';
import RegisterClient from './register-client';

const mockRegister = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/shared/session/session-provider', () => ({
  useSession: () => ({ register: mockRegister }),
}));

describe('RegisterClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegister.mockResolvedValue(undefined);
  });

  it('rejeita uma senha comum no formulário sem enviar a requisição', async () => {
    const user = userEvent.setup();
    render(<RegisterClient />);

    await user.type(screen.getByRole('textbox', { name: /^E-mail/ }), 'ana@example.com');
    await user.type(screen.getByLabelText(/^Senha/), 'senha@1234');
    await user.type(screen.getByLabelText(/^Confirmar senha/), 'senha@1234');

    expect(screen.getByText('Esta senha é muito comum. Escolha uma senha menos previsível.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeDisabled();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('rejeita uma senha acima do limite sem truncar o valor digitado', async () => {
    const user = userEvent.setup();
    render(<RegisterClient />);

    await user.type(screen.getByRole('textbox', { name: /^E-mail/ }), 'ana@example.com');
    const password = screen.getByLabelText(/^Senha/);
    const confirmation = screen.getByLabelText(/^Confirmar senha/);
    expect(password).not.toHaveAttribute('maxlength');
    expect(confirmation).not.toHaveAttribute('maxlength');

    const longPassword = `A${'b'.repeat(200)}`;
    fireEvent.change(password, { target: { value: longPassword } });
    fireEvent.change(confirmation, { target: { value: longPassword } });

    expect(screen.getByText('A senha deve ter no máximo 200 caracteres.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeDisabled();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it.each(['ana-sem-dominio', 'a..b@example.com', '.ana@example.com', 'ana@-example.com'])(
    'rejeita o e-mail malformado %s sem enviar a requisição',
    async (invalidEmail) => {
      const user = userEvent.setup();
      render(<RegisterClient />);

      await user.type(screen.getByRole('textbox', { name: /^E-mail/ }), invalidEmail);
      await user.type(screen.getByLabelText(/^Senha/), 'Coruja-Montanha!2026');
      await user.type(screen.getByLabelText(/^Confirmar senha/), 'Coruja-Montanha!2026');

      expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Criar conta' })).toBeDisabled();
      expect(mockRegister).not.toHaveBeenCalled();
    },
  );

  it('envia um cadastro válido e segue para o dashboard', async () => {
    const user = userEvent.setup();
    render(<RegisterClient />);

    await user.type(screen.getByRole('textbox', { name: 'Nome' }), 'Ana');
    await user.type(screen.getByRole('textbox', { name: /^E-mail/ }), 'ana@example.com');
    await user.type(screen.getByLabelText(/^Senha/), 'Coruja-Montanha!2026');
    await user.type(screen.getByLabelText(/^Confirmar senha/), 'Coruja-Montanha!2026');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledWith('ana@example.com', 'Coruja-Montanha!2026', 'Ana'));
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('mostra os detalhes de validação enviados pela API sem redirecionar', async () => {
    mockRegister.mockRejectedValueOnce(
      new ApiError({
        statusCode: 400,
        code: 'validation_failed',
        message: 'Os dados enviados são inválidos.',
        details: ['Esta senha é muito comum. Escolha uma senha menos previsível.'],
      }),
    );
    const user = userEvent.setup();
    render(<RegisterClient />);

    await user.type(screen.getByRole('textbox', { name: /^E-mail/ }), 'ana@example.com');
    await user.type(screen.getByLabelText(/^Senha/), 'Coruja-Montanha!2026');
    await user.type(screen.getByLabelText(/^Confirmar senha/), 'Coruja-Montanha!2026');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Os dados enviados são inválidos.')).toBeInTheDocument();
    expect(screen.getByText('Esta senha é muito comum. Escolha uma senha menos previsível.')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('mostra a falha interna e o requestId sem redirecionar', async () => {
    mockRegister.mockRejectedValueOnce(
      new ApiError({
        statusCode: 500,
        code: 'internal_error',
        message: 'Não foi possível criar a conta.',
        requestId: 'request-register-500',
      }),
    );
    const user = userEvent.setup();
    render(<RegisterClient />);

    await user.type(screen.getByRole('textbox', { name: /^E-mail/ }), 'ana@example.com');
    await user.type(screen.getByLabelText(/^Senha/), 'Coruja-Montanha!2026');
    await user.type(screen.getByLabelText(/^Confirmar senha/), 'Coruja-Montanha!2026');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Não foi possível criar a conta.')).toBeInTheDocument();
    expect(screen.getByText(/request-register-500/)).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
