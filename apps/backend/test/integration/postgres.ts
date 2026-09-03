import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * A throwaway PostgreSQL 16 for the integration suite.
 *
 * CI and most laptops have Docker; this machine class may not. `embedded-postgres`
 * ships the real PostgreSQL 16 binaries and runs them from a temp directory, so
 * the suite exercises genuine `date` columns, native enums, CHECK constraints,
 * partial unique indexes and true concurrency — none of which a mock or an
 * in-memory shim can reproduce.
 *
 * Set `TEST_DATABASE_URL` to point the suite at an existing database instead
 * (that is what the Docker-based CI job does).
 */

export interface TestDatabase {
  url: string;
  stop: () => Promise<void>;
}

const PORT = Number(process.env.TEST_PG_PORT ?? 55433);
const DB_NAME = 'finance_integration';

export async function startTestDatabase(): Promise<TestDatabase> {
  const external = process.env.TEST_DATABASE_URL;
  if (external) {
    return { url: external, stop: async () => {} };
  }

  // Imported lazily so the package is only required when it is actually needed.
  const { default: EmbeddedPostgres } = (await import('embedded-postgres')) as {
    default: new (opts: Record<string, unknown>) => {
      initialise: () => Promise<void>;
      start: () => Promise<void>;
      stop: () => Promise<void>;
      createDatabase: (name: string) => Promise<void>;
    };
  };

  const dataDir = mkdtempSync(join(tmpdir(), 'finance-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: false,
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB_NAME);

  return {
    url: `postgresql://postgres:postgres@127.0.0.1:${PORT}/${DB_NAME}`,
    stop: async () => {
      await pg.stop();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/** Applies the committed migrations — the same ones production runs. */
export function runMigrations(databaseUrl: string) {
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'migrate', 'deploy'], {
    cwd: join(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
