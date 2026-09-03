import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertDisposableDatabaseUrl } from './database-safety';

/**
 * A throwaway PostgreSQL 16 for the integration suite.
 *
 * CI and most laptops have Docker; this machine class may not. `embedded-postgres`
 * ships the real PostgreSQL 16 binaries and runs them from a temp directory, so
 * the suite exercises genuine `date` columns, native enums, CHECK constraints,
 * partial unique indexes and true concurrency — none of which a mock or an
 * in-memory shim can reproduce.
 *
 * Set `TEST_DATABASE_URL` to point the suite at an explicitly disposable
 * database ending in `_test`, `_ci` or `_e2e` (as Docker-based CI does).
 */

export interface TestDatabase {
  url: string;
  stop: () => Promise<void>;
}

const DB_NAME = 'finance_integration_test';

/** Avoids collisions when browser and integration suites run side by side. */
async function testDatabasePort(): Promise<number> {
  if (process.env.TEST_PG_PORT) {
    const configured = Number(process.env.TEST_PG_PORT);
    if (!Number.isInteger(configured) || configured < 1 || configured > 65_535) {
      throw new Error('TEST_PG_PORT must be an integer between 1 and 65535.');
    }
    return configured;
  }

  return await new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close();
        reject(new Error('Could not reserve a disposable PostgreSQL port.'));
        return;
      }
      const { port } = address;
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const external = process.env.TEST_DATABASE_URL;
  if (external) {
    return { url: assertDisposableDatabaseUrl(external), stop: async () => {} };
  }

  // Imported lazily so the package is only required when it is actually needed.
  const { default: EmbeddedPostgres } = (await import('embedded-postgres')) as {
    default: new (
      opts: Record<string, unknown>,
    ) => {
      initialise: () => Promise<void>;
      start: () => Promise<void>;
      stop: () => Promise<void>;
      createDatabase: (name: string) => Promise<void>;
    };
  };

  const dataDir = mkdtempSync(join(tmpdir(), 'finance-pg-'));
  const port = await testDatabasePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB_NAME);

  return {
    url: assertDisposableDatabaseUrl(`postgresql://postgres:postgres@127.0.0.1:${port}/${DB_NAME}`),
    stop: async () => {
      await pg.stop();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/** Applies the committed migrations — the same ones production runs. */
export function runMigrations(databaseUrl: string) {
  const backendRoot = join(__dirname, '..', '..');
  const prismaCli = join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');

  // Calling npx.cmd through child_process is EINVAL on some Windows setups.
  // Running the workspace-local JS entrypoint through the current Node binary
  // is deterministic and works identically on Windows and Linux CI.
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: assertDisposableDatabaseUrl(databaseUrl) },
    stdio: 'pipe',
  });
}
