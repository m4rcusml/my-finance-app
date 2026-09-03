import { ApiError } from '@/shared/lib/api/errors';
import { makeQueryClient } from './client';

describe('makeQueryClient', () => {
  it('cria caches isolados para sessões diferentes', () => {
    const firstClient = makeQueryClient();
    const secondClient = makeQueryClient();
    const privateKey = ['session', 'user-a', 'accounts'] as const;

    firstClient.setQueryData(privateKey, ['Conta da pessoa A']);

    expect(secondClient).not.toBe(firstClient);
    expect(secondClient.getQueryData(privateKey)).toBeUndefined();

    firstClient.clear();
    secondClient.clear();
  });

  it('não repete uma consulta que falhou com erro 4xx', async () => {
    const client = makeQueryClient();
    const error = new ApiError({
      statusCode: 403,
      code: 'forbidden',
      message: 'Você não tem acesso a este recurso.',
    });
    const queryFn = jest.fn().mockRejectedValue(error);

    await expect(client.fetchQuery({ queryKey: ['forbidden-resource'], queryFn, retryDelay: 0 })).rejects.toBe(error);

    expect(queryFn).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it('repete erros transitórios no máximo duas vezes', async () => {
    const client = makeQueryClient();
    const queryFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Falha temporária de rede'))
      .mockRejectedValueOnce(
        new ApiError({
          statusCode: 503,
          code: 'internal_error',
          message: 'Serviço indisponível.',
        }),
      )
      .mockResolvedValueOnce('recuperado');

    await expect(client.fetchQuery({ queryKey: ['transient-resource'], queryFn, retryDelay: 0 })).resolves.toBe(
      'recuperado',
    );

    expect(queryFn).toHaveBeenCalledTimes(3);
    client.clear();
  });
});
