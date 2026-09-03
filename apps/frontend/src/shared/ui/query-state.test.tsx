import type { PaginatedResponse } from '@finance/contracts';
import type { UseQueryResult } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/shared/lib/api/errors';
import { PaginatedBoundary, QueryBoundary } from './query-state';

function queryResult<T>(overrides: Partial<UseQueryResult<T>>): UseQueryResult<T> {
  return {
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    ...overrides,
  } as UseQueryResult<T>;
}

describe('QueryBoundary', () => {
  it('mantém o conteúdo oculto enquanto a consulta está carregando', () => {
    render(
      <QueryBoundary query={queryResult({ isPending: true })} loadingLabel="Carregando resumo…">
        {() => <p>Resumo carregado</p>}
      </QueryBoundary>,
    );

    expect(screen.getByText('Carregando resumo…')).toBeInTheDocument();
    expect(screen.queryByText('Resumo carregado')).not.toBeInTheDocument();
  });
});

describe('PaginatedBoundary', () => {
  it('mostra o erro e permite tentar novamente sem exibir um falso estado vazio', async () => {
    const user = userEvent.setup();
    const refetch = jest.fn();
    const error = new ApiError({
      statusCode: 422,
      code: 'validation_failed',
      message: 'Os filtros enviados são inválidos.',
      details: ['A data inicial deve vir antes da data final.'],
    });

    render(
      <PaginatedBoundary<string> query={queryResult({ isError: true, error, refetch })} emptyTitle="Nenhum lançamento">
        {(items) => <p>{items.join(', ')}</p>}
      </PaginatedBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar');
    expect(alert).toHaveTextContent('Os filtros enviados são inválidos.');
    expect(alert).toHaveTextContent('A data inicial deve vir antes da data final.');
    expect(screen.queryByText('Nenhum lançamento')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('só mostra o estado vazio depois de uma resposta paginada bem-sucedida', () => {
    const response: PaginatedResponse<string> = {
      data: [],
      meta: {
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    };

    render(
      <PaginatedBoundary<string>
        query={queryResult({ data: response })}
        emptyTitle="Nenhum lançamento"
        emptyMessage="Cadastre o primeiro lançamento."
      >
        {(items) => <p>{items.join(', ')}</p>}
      </PaginatedBoundary>,
    );

    expect(screen.getByText('Nenhum lançamento')).toBeInTheDocument();
    expect(screen.getByText('Cadastre o primeiro lançamento.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('entrega separadamente os itens e metadados da resposta paginada', () => {
    const response: PaginatedResponse<string> = {
      data: ['Lançamento 21'],
      meta: {
        page: 2,
        limit: 20,
        totalItems: 21,
        totalPages: 2,
        hasPreviousPage: true,
        hasNextPage: false,
      },
    };

    render(
      <PaginatedBoundary<string> query={queryResult({ data: response })} emptyTitle="Nenhum lançamento">
        {(items, meta) => (
          <p>
            {items[0]} — página {meta.page} de {meta.totalPages}
          </p>
        )}
      </PaginatedBoundary>,
    );

    expect(screen.getByText('Lançamento 21 — página 2 de 2')).toBeInTheDocument();
  });
});
