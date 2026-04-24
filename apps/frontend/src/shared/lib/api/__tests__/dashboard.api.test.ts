import { dashboardApi } from '../dashboard';

describe('dashboardApi contract', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should call /dashboard (not /dashboard/overview)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        totals: { totalBalance: 0 },
        accounts: [],
        creditCards: [],
        latestTransactions: [],
        fixedTransactions: [],
        annualBalance: [],
      }),
    });

    await dashboardApi.overview();

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/dashboard');
    expect(url).not.toContain('/dashboard/overview');
  });

  it('should include referenceDate query when provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        totals: { totalBalance: 0 },
        accounts: [],
        creditCards: [],
        latestTransactions: [],
        fixedTransactions: [],
        annualBalance: [],
      }),
    });

    await dashboardApi.overview('2026-04-01');

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('referenceDate=2026-04-01');
  });
});
