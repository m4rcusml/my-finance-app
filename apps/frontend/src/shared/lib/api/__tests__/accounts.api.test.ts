import { accountsApi } from '../accounts';

describe('accountsApi contract', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should send lowercase account types to match backend DTO', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      json: async () => ({
        id: 'acc-1',
        name: 'Main',
        institution: 'Bank',
        type: 'checking',
        initialBalance: 1000,
      }),
    });

    await accountsApi.create({
      name: 'Main',
      institution: 'Bank',
      type: 'checking',
      initialBalance: 1000,
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);

    expect(body.type).toBe('checking');
    expect(body.type).not.toBe('CHECKING');
  });

  it('should accept all backend account types', async () => {
    const validTypes = ['checking', 'savings', 'investment', 'cash', 'other'];

    for (const type of validTypes) {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 201,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 'acc-1', type }),
      });

      await accountsApi.create({
        name: 'Test',
        institution: 'Bank',
        type: type as any,
        initialBalance: 0,
      });

      const [, init] = (global.fetch as jest.Mock).mock.calls.at(-1);
      const body = JSON.parse(init.body);
      expect(body.type).toBe(type);
    }
  });
});
