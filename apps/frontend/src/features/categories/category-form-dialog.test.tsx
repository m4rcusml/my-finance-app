import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryForm } from './category-form-dialog';

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
jest.mock('./mutations', () => ({
  useCreateCategoryMutation: () => ({ mutateAsync: mockCreate, isPending: false, isError: false }),
  useUpdateCategoryMutation: () => ({ mutateAsync: mockUpdate, isPending: false, isError: false }),
}));

beforeEach(() => {
  mockCreate.mockReset();
  mockUpdate.mockReset();
});

it('saves the selected color with the trimmed name and transaction type', async () => {
  const user = userEvent.setup();
  mockCreate.mockResolvedValue({});
  render(<CategoryForm />);
  await user.type(screen.getByLabelText(/Nome/), '  Educação  ');
  await user.click(screen.getByRole('radio', { name: 'Azul' }));
  await user.click(screen.getByRole('button', { name: 'Criar categoria' }));
  await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ name: 'Educação', type: 'expense', color: '#60a5fa' }));
  expect(screen.getByLabelText(/Nome/)).toHaveValue('');
});

it('retains the entered name when saving fails', async () => {
  const user = userEvent.setup();
  mockCreate.mockRejectedValue(new Error('Falha de rede'));
  render(<CategoryForm />);
  await user.type(screen.getByLabelText(/Nome/), 'Educação');
  await user.click(screen.getByRole('button', { name: 'Criar categoria' }));
  await waitFor(() => expect(mockCreate).toHaveBeenCalled());
  expect(screen.getByLabelText(/Nome/)).toHaveValue('Educação');
});
