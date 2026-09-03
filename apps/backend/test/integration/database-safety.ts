const DISPOSABLE_DATABASE_SUFFIX = /_(?:test|ci|e2e)$/i;

/**
 * Integration setup truncates every application table. Refuse ambiguous URLs
 * before connecting so a typo cannot erase a developer or production database.
 */
export function assertDisposableDatabaseUrl(databaseUrl: string): string {
  if (process.env.ALLOW_DESTRUCTIVE_TEST_DB === 'true') {
    return databaseUrl;
  }

  let databaseName = '';
  try {
    const parsed = new URL(databaseUrl);
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (!DISPOSABLE_DATABASE_SUFFIX.test(databaseName)) {
    throw new Error(
      `Refusing destructive integration tests against database "${databaseName || '(missing)'}". ` +
        'Use a disposable database ending in _test, _ci or _e2e. ' +
        'Set ALLOW_DESTRUCTIVE_TEST_DB=true only after independently verifying the target.',
    );
  }

  return databaseUrl;
}
