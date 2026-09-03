import { assertDisposableDatabaseUrl } from './database-safety';

describe('destructive test database guard', () => {
  const originalOverride = process.env.ALLOW_DESTRUCTIVE_TEST_DB;

  beforeEach(() => {
    delete process.env.ALLOW_DESTRUCTIVE_TEST_DB;
  });

  afterAll(() => {
    if (originalOverride === undefined) delete process.env.ALLOW_DESTRUCTIVE_TEST_DB;
    else process.env.ALLOW_DESTRUCTIVE_TEST_DB = originalOverride;
  });

  it.each(['finance_test', 'finance_ci', 'finance_e2e'])('accepts the disposable %s database', (name) => {
    const url = `postgresql://finance:finance@127.0.0.1:5432/${name}?schema=public`;
    expect(assertDisposableDatabaseUrl(url)).toBe(url);
  });

  it('rejects a database without a disposable suffix', () => {
    expect(() => assertDisposableDatabaseUrl('postgresql://finance:finance@127.0.0.1:5432/finance')).toThrow(
      'Refusing destructive integration tests against database "finance"',
    );
  });

  it('rejects malformed connection strings before connecting', () => {
    expect(() => assertDisposableDatabaseUrl('not-a-database-url')).toThrow(
      'TEST_DATABASE_URL must be a valid PostgreSQL connection URL.',
    );
  });

  it('requires an explicit override for a deliberately non-suffixed target', () => {
    process.env.ALLOW_DESTRUCTIVE_TEST_DB = 'true';
    const url = 'postgresql://finance:finance@127.0.0.1:5432/verified_scratch';
    expect(assertDisposableDatabaseUrl(url)).toBe(url);
  });
});
