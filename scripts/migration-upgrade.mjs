#!/usr/bin/env node
/**
 * Runs the populated pre-V1 upgrade fixture against an isolated PostgreSQL 16
 * instance. An external database is accepted only through the explicit
 * MIGRATION_TEST_DATABASE_URL variable; upgrade-check.mjs enforces the
 * disposable-name suffix before changing it.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = join(root, 'apps', 'backend');
const fixture = join(backendRoot, 'test', 'migrations', 'upgrade-check.mjs');

async function availablePort(configured) {
  if (configured !== undefined) {
    const port = Number(configured);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error('MIGRATION_TEST_DATABASE_PORT must be an integer between 1 and 65535.');
    }
    return port;
  }

  return await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close();
        reject(new Error('Could not reserve a port for the migration test.'));
        return;
      }
      probe.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

let database;
let dataDirectory;
let databaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;

try {
  if (!databaseUrl) {
    const requireFromBackend = createRequire(join(backendRoot, 'package.json'));
    const embeddedModule = requireFromBackend('embedded-postgres');
    const EmbeddedPostgres = embeddedModule.default ?? embeddedModule;
    const port = await availablePort(process.env.MIGRATION_TEST_DATABASE_PORT);

    dataDirectory = mkdtempSync(join(tmpdir(), 'finance-upgrade-pg-'));
    database = new EmbeddedPostgres({
      databaseDir: dataDirectory,
      user: 'postgres',
      password: 'postgres',
      port,
      persistent: false,
    });
    await database.initialise();
    await database.start();
    await database.createDatabase('finance_upgrade_test');
    databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/finance_upgrade_test`;
  }

  const result = spawnSync(process.execPath, [fixture], {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  if (database) await database.stop();
  if (dataDirectory) rmSync(dataDirectory, { recursive: true, force: true });
}
