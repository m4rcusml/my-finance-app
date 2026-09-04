import type { Goal } from '@finance/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoalAmountDialog } from './goal-amount-dialog';

const mockUpdate = jest.fn();
jest.mock('@/features/goals/mutations', () => ({
  useUpdateGoalAmountMutation: () => ({ mutateAsync: mockUpdate, isPending: false }),
}));
jest.mock('@/shared/ui/toast', () => ({ useToast: () => ({ error: jest.fn() }) }));
const goal: Goal = {
  id: 'goal-1',
  name: 'Reserva de emergência',
  type: 'saving',
  targetAmount: 1000,
  currentAmount: 250,
  progress: 0.25,
  progressSource: 'manual',
  deadline: '2026-12-31',
  relatedAccountId: null,
  relatedCategoryId: null,
  createdAt: '',
  updatedAt: '',
};

beforeEach(() => {
  mockUpdate.mockReset().mockResolvedValue(goal);
});

it('atualiza somente o progresso manual e não envia data de auditoria como campo editável', async () => {
  const user = userEvent.setup();
  const onClose = jest.fn();
  render(<GoalAmountDialog goal={goal} onClose={onClose} />);
  const amount = screen.getByLabelText('Novo valor guardado (R$)', { exact: false });
  await user.clear(amount);
  await user.type(amount, '500,50');
  await user.click(screen.getByRole('button', { name: 'Atualizar' }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ id: goal.id, currentAmount: 500.5 }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/esta ação não altera contas ou transações/)).toBeInTheDocument();
});

it('mantém o diálogo aberto com erro acionável quando a atualização falha', async () => {
  mockUpdate.mockRejectedValue(new Error('Sem conexão'));
  const user = userEvent.setup();
  const onClose = jest.fn();
  render(<GoalAmountDialog goal={goal} onClose={onClose} />);
  await user.click(screen.getByRole('button', { name: 'Atualizar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão');
  expect(onClose).not.toHaveBeenCalled();
});
