import { categoriesApi } from '../categories';

describe('categoriesApi contract', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should send lowercase type to match backend DTO', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      json: async () => ({
        id: 'cat-1',
        name: 'Food',
        type: 'expense',
      }),
    });

    await categoriesApi.create({
      name: 'Food',
      type: 'expense',
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);

    expect(body.type).toBe('expense');
    expect(body.type).not.toBe('EXPENSE');
  });

  it('should accept "both" type', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      json: async () => ({
        id: 'cat-1',
        name: 'General',
        type: 'both',
      }),
    });

    await categoriesApi.create({
      name: 'General',
      type: 'both',
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);

    expect(body.type).toBe('both');
  });
});
