import type { OccurrenceWithTemplate } from '@finance/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmOccurrenceDialog } from './confirm-occurrence-dialog';

const occurrence: OccurrenceWithTemplate = {
  id: 'occurrence-1',
  fixedTransactionId: 'fixed-1',
  periodYear: 2028,
  periodMonth: 2,
  status: 'pending',
  realDate: null,
  transactionId: null,
  dueDate: '2028-02-29',
  type: 'expense',
  value: 100,
  description: 'Aluguel',
  categoryId: 'category-1',
  accountId: 'account-1',
  creditCardId: null,
  createdAt: '',
  updatedAt: '',
  fixedTransaction: { id: 'fixed-1', description: 'Aluguel', referenceDay: 31 },
  category: { id: 'category-1', name: 'Moradia', type: 'expense' },
};

function mutation() {
  return { mutate: jest.fn(), reset: jest.fn(), isPending: false, isError: false, error: null };
}

it('confirma com data civil e valor real, preservando o valor previsto ao abrir', async () => {
  const user = userEvent.setup();
  const write = mutation();
  render(<ConfirmOccurrenceDialog open occurrence={occurrence} mutation={write} onClose={jest.fn()} />);
  expect(screen.getByLabelText('Data real', { exact: false })).toHaveValue('2028-02-29');
  const value = screen.getByLabelText('Valor real');
  expect(value).toHaveValue('100,00');
  await user.clear(value);
  await user.type(value, '105,25');
  fireEvent.change(screen.getByLabelText('Data real', { exact: false }), { target: { value: '2028-03-01' } });
  await user.click(screen.getByRole('button', { name: 'Confirmar agora' }));
  expect(write.mutate).toHaveBeenCalledWith(
    { id: occurrence.id, realDate: '2028-03-01', value: 105.25 },
    expect.any(Object),
  );
});

it('encaminha ignorar sem confirmar ou criar uma transação', async () => {
  const user = userEvent.setup();
  const write = mutation();
  const onSkip = jest.fn();
  render(<ConfirmOccurrenceDialog open occurrence={occurrence} mutation={write} onClose={jest.fn()} onSkip={onSkip} />);
  await user.click(screen.getByRole('button', { name: 'Ignorar' }));
  expect(onSkip).toHaveBeenCalledTimes(1);
  expect(write.mutate).not.toHaveBeenCalled();
});
