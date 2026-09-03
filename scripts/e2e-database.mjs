import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const databasePort = Number(process.env.E2E_DATABASE_PORT ?? 55433);
const readinessPort = Number(process.env.E2E_DATABASE_READY_PORT ?? 55434);
const databaseName = 'finance_browser_e2e';
const externalUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

// Build the shared runtime once before Playwright launches backend and frontend
// in parallel. Running both package lifecycle pre-scripts concurrently would
// make two tsc processes write the same dist directory on Windows.
const typescriptCli = join(root, 'packages', 'contracts', 'node_modules', 'typescript', 'bin', 'tsc');
execFileSync(process.execPath, [typescriptCli, '-p', join(root, 'packages', 'contracts', 'tsconfig.build.json')], {
  cwd: join(root, 'packages', 'contracts'),
  stdio: 'inherit',
});

function assertDisposable(url) {
  let name;
  try {
    name = new URL(url).pathname.replace(/^\//, '');
  } catch {
    throw new Error('TEST_DATABASE_URL/DATABASE_URL do browser E2E não é uma URL PostgreSQL válida.');
  }
  if (!/(?:_test|_ci|_e2e)$/.test(name)) {
    throw new Error(`Browser E2E recusou o banco “${name}”: o nome precisa terminar em _test, _ci ou _e2e.`);
  }
  return url;
}

let database;
let dataDirectory;
let databaseUrl;

if (externalUrl) {
  databaseUrl = assertDisposable(externalUrl);
} else {
  const requireFromBackend = createRequire(join(root, 'apps', 'backend', 'package.json'));
  const embeddedModule = requireFromBackend('embedded-postgres');
  const EmbeddedPostgres = embeddedModule.default ?? embeddedModule;

  dataDirectory = mkdtempSync(join(tmpdir(), 'finance-browser-pg-'));
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
  databaseUrl = assertDisposable(`postgresql://postgres:postgres@127.0.0.1:${databasePort}/${databaseName}`);
}

const prismaCli = join(root, 'apps', 'backend', 'node_modules', 'prisma', 'build', 'index.js');
execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: join(root, 'apps', 'backend'),
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: 'inherit',
});

const readinessServer = createServer((request, response) => {
  if (request.url === '/ready') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('ready');
    return;
  }
  response.writeHead(404);
  response.end();
});

await new Promise((resolve) => readinessServer.listen(readinessPort, '127.0.0.1', resolve));

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await new Promise((resolve) => readinessServer.close(resolve));
  if (database) await database.stop();
  if (dataDirectory) rmSync(dataDirectory, { recursive: true, force: true });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await stop();
    process.exit(0);
  });
}
