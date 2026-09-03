#!/usr/bin/env node
/**
 * Build-artifact smoke gate with an isolated PostgreSQL 16 database.
 *
 * `pnpm test:smoke` intentionally does not build the application: it verifies
 * the exact `apps/backend/dist/main.js` produced by the preceding build gate.
 * Locally it starts embedded PostgreSQL in a temporary directory. CI can set
 * SMOKE_DATABASE_URL, but the database name must still identify it as
 * disposable (`*_test`, `*_ci` or `*_e2e`).
 */

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = join(root, 'apps', 'backend');
const backendArtifact = join(backendRoot, 'dist', 'main.js');
const databaseName = 'finance_smoke_test';

function assertDisposableDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('SMOKE_DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('SMOKE_DATABASE_URL must use postgresql://.');
  }
  const name = url.pathname.replace(/^\//, '');
  if (!/(?:_test|_ci|_e2e)$/.test(name)) {
    throw new Error(`Smoke gate refused database "${name}": its name must end in _test, _ci or _e2e.`);
  }
  return value;
}

async function availablePort(configured, label) {
  if (configured !== undefined) {
    const port = Number(configured);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error(`${label} must be an integer between 1 and 65535.`);
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
        reject(new Error(`Could not reserve a port for ${label}.`));
        return;
      }
      probe.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  const timeout = new Promise((resolve) => {
    const timer = setTimeout(resolve, 10_000, 'timeout');
    timer.unref();
  });
  if ((await Promise.race([exited, timeout])) === 'timeout' && child.exitCode === null) {
    child.kill('SIGKILL');
    await exited;
  }
}

if (!existsSync(backendArtifact)) {
  throw new Error(`Production artifact not found at ${backendArtifact}. Run "pnpm build:backend" first.`);
}

let database;
let dataDirectory;
let backend;
let databaseUrl;
const logs = [];

try {
  if (process.env.SMOKE_DATABASE_URL) {
    databaseUrl = assertDisposableDatabaseUrl(process.env.SMOKE_DATABASE_URL);
  } else {
    const requireFromBackend = createRequire(join(backendRoot, 'package.json'));
    const embeddedModule = requireFromBackend('embedded-postgres');
    const EmbeddedPostgres = embeddedModule.default ?? embeddedModule;
    const databasePort = await availablePort(process.env.SMOKE_DATABASE_PORT, 'SMOKE_DATABASE_PORT');

    dataDirectory = mkdtempSync(join(tmpdir(), 'finance-smoke-pg-'));
    database = new EmbeddedPostgres({
      databaseDir: dataDirectory,
      user: 'postgres',
      password: 'postgres',
      port: databasePort,
      persistent: false,
    });
    await database.initialise();
    await database.start();
    await database.createDatabase(databaseName);
    databaseUrl = assertDisposableDatabaseUrl(
      `postgresql://postgres:postgres@127.0.0.1:${databasePort}/${databaseName}`,
    );
  }

  const prismaCli = join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  const backendPort = await availablePort(process.env.SMOKE_BACKEND_PORT, 'SMOKE_BACKEND_PORT');
  backend = spawn(process.execPath, [backendArtifact], {
    cwd: backendRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(backendPort),
      DATABASE_URL: databaseUrl,
      JWT_SECRET: process.env.JWT_SECRET ?? 'smoke-access-secret-value-at-least-32-characters',
      CORS_ORIGINS: 'https://app.example.test',
      APP_TIMEZONE: 'America/Sao_Paulo',
      COOKIE_SECURE: 'true',
      COOKIE_SAMESITE: 'lax',
      ENABLE_CRON: 'false',
      ENABLE_SWAGGER: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  for (const stream of [backend.stdout, backend.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      logs.push(chunk);
      if (logs.length > 200) logs.shift();
    });
  }

  execFileSync(process.execPath, [join(root, 'scripts', 'smoke.mjs'), '--base', `http://127.0.0.1:${backendPort}`], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
} catch (error) {
  if (logs.length > 0) {
    process.stderr.write('\nBackend log (last buffered chunks):\n');
    process.stderr.write(logs.join(''));
  }
  throw error;
} finally {
  await stopChild(backend);
  if (database) await database.stop();
  if (dataDirectory) rmSync(dataDirectory, { recursive: true, force: true });
}
