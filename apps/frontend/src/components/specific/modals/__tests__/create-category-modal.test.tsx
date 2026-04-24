import { render, screen, fireEvent } from '@testing-library/react';
import { CreateCategoryModal } from '../create-category-modal';

const mockMutate = jest.fn();

jest.mock('@/features/categories/mutations', () => ({
  useCreateCategoryMutation: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

describe('CreateCategoryModal', () => {
  beforeEach(() => {
    mockMutate.mockClear();
  });

  it('should submit with lowercase type', () => {
    render(<CreateCategoryModal isOpen={true} onClose={jest.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Alimentação, Transporte, Salário'), {
      target: { value: 'Food' },
    });

    fireEvent.click(screen.getByText('Criar categoria'));

    expect(mockMutate).toHaveBeenCalledTimes(1);

    const payload = mockMutate.mock.calls[0][0];
    expect(payload.type).toBe('expense');
    expect(payload.type).not.toBe('EXPENSE');
    expect(payload.name).toBe('Food');
  });

  it('should submit "both" type when selected', () => {
    render(<CreateCategoryModal isOpen={true} onClose={jest.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Alimentação, Transporte, Salário'), {
      target: { value: 'General' },
    });
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'both' },
    });

    fireEvent.click(screen.getByText('Criar categoria'));

    const payload = mockMutate.mock.calls[0][0];
    expect(payload.type).toBe('both');
  });
});
