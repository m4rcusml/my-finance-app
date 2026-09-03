import type { PaginationMeta } from '@finance/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './pagination';

const middlePage: PaginationMeta = {
  page: 2,
  limit: 20,
  totalItems: 45,
  totalPages: 3,
  hasPreviousPage: true,
  hasNextPage: true,
};

describe('Pagination', () => {
  it('expõe o intervalo real e navega usando os metadados da API', async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();
    const onLimitChange = jest.fn();

    render(
      <Pagination meta={middlePage} itemLabel="transações" onPageChange={onPageChange} onLimitChange={onLimitChange} />,
    );

    expect(screen.getByRole('navigation', { name: 'Paginação' })).toHaveTextContent('Mostrando 21–40 de 45 transações');
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Por página' }), '50');

    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
    expect(onLimitChange).toHaveBeenCalledWith(50);
  });

  it('desabilita navegação e mostra um intervalo vazio sem inventar registros', () => {
    render(
      <Pagination
        meta={{
          page: 1,
          limit: 20,
          totalItems: 0,
          totalPages: 0,
          hasPreviousPage: false,
          hasNextPage: false,
        }}
        onPageChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Paginação' })).toHaveTextContent('Mostrando 0–0 de 0 registros');
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
  });
});
