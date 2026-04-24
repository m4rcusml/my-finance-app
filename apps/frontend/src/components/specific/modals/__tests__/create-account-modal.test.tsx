import { render, screen, fireEvent } from '@testing-library/react';
import { CreateAccountModal } from '../create-account-modal';

const mockMutate = jest.fn();

jest.mock('@/features/accounts/mutations', () => ({
  useCreateAccountMutation: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

describe('CreateAccountModal', () => {
  beforeEach(() => {
    mockMutate.mockClear();
  });

  it('should submit with lowercase account type', () => {
    render(<CreateAccountModal isOpen={true} onClose={jest.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Conta Principal'), {
      target: { value: 'Main Account' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex: Nubank, Inter, Carteira'), {
      target: { value: 'Nubank' },
    });
    fireEvent.change(screen.getByPlaceholderText('0,00'), {
      target: { value: '1000' },
    });

    fireEvent.click(screen.getByText('Criar conta'));

    expect(mockMutate).toHaveBeenCalledTimes(1);

    const payload = mockMutate.mock.calls[0][0];
    expect(payload.type).toBe('checking');
    expect(payload.type).not.toBe('CHECKING');
    expect(payload.name).toBe('Main Account');
    expect(payload.institution).toBe('Nubank');
    expect(payload.initialBalance).toBe(1000);
  });

  it('should submit investment type as lowercase', () => {
    render(<CreateAccountModal isOpen={true} onClose={jest.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Conta Principal'), {
      target: { value: 'Stocks' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex: Nubank, Inter, Carteira'), {
      target: { value: 'XP' },
    });
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'investment' },
    });
    fireEvent.change(screen.getByPlaceholderText('0,00'), {
      target: { value: '5000' },
    });

    fireEvent.click(screen.getByText('Criar conta'));

    const payload = mockMutate.mock.calls[0][0];
    expect(payload.type).toBe('investment');
    expect(payload.type).not.toBe('INVESTMENT');
  });
});
